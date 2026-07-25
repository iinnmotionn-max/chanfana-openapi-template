// Local-agent API. The polling endpoints are secret-gated: without
// LOCAL_AGENT_SECRET set on the Worker they answer 503, and a wrong secret is
// 401. The queue is inert until the creator runs the agent on their machine.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { agentSecret, claimNext, completeTask, localOverview } from "../engine/local";
import { isConfigured, matchSecret, noteLegacyUse } from "../engine/rotation";
import { clearFailures, consume, LIMITS } from "../engine/ratelimit";

// Auth failures are rate-limited into a lockout; call volume is capped
// separately so a runaway agent loop can't hammer the queue.
async function gate(c: AppContext, provided: string, host = ""): Promise<Response | null> {
	if (!isConfigured(c.env, "LOCAL_AGENT_SECRET")) {
		return c.json({ success: false, errors: [{ code: 5032, message: "Local agent disabled — set LOCAL_AGENT_SECRET" }] }, 503);
	}

	const locked = await consume(c.env.DB, "auth:local", LIMITS.auth.limit, LIMITS.auth.window, LIMITS.auth.lockFor);
	if (!locked.ok) {
		return c.json({ success: false, errors: [{ code: 4290, message: `Too many failed attempts — retry in ${locked.retryAfter}s` }] }, 429, {
			"Retry-After": String(locked.retryAfter),
		});
	}
	// Accepts the current secret, or the outgoing one during a rotation window.
	const age = matchSecret(c.env, "LOCAL_AGENT_SECRET", provided);
	if (age === null) {
		return c.json({ success: false, errors: [{ code: 4012, message: "Bad agent secret" }] }, 401);
	}
	if (age === "previous") {
		// Valid, but this caller is on the outgoing key — record it so the
		// rotation window is visible and can actually be closed.
		await noteLegacyUse(c.env.DB, "local agent", host);
	}
	// Correct secret — forgive earlier fumbles, then cap call volume.
	await clearFailures(c.env.DB, "auth:local");
	const called = await consume(c.env.DB, "call:local", LIMITS.local.limit, LIMITS.local.window);
	if (!called.ok) {
		return c.json({ success: false, errors: [{ code: 4291, message: `Rate limit exceeded — retry in ${called.retryAfter}s` }] }, 429, {
			"Retry-After": String(called.retryAfter),
		});
	}
	return null;
}

export class LocalStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Local Agent"],
		summary: "Is the machine bridge configured, and what's in the queue",
		responses: {
			"200": { description: "Bridge status + recent tasks", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await localOverview(c.env.DB, c.env) };
	}
}

export class LocalNext extends OpenAPIRoute {
	public schema = {
		tags: ["Local Agent"],
		summary: "The agent claims the next queued task (secret-gated)",
		request: {
			body: contentJson(z.object({ secret: z.string().default(""), host: z.string().max(80).default("") })),
		},
		responses: {
			"200": { description: "A task, or null when the queue is empty", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"401": { description: "Bad agent secret" },
			"503": { description: "Local agent disabled" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const denied = await gate(c, body.secret, body.host);
		if (denied) return denied;
		return { success: true, result: await claimNext(c.env.DB, body.host || "unknown") };
	}
}

export class LocalResult extends OpenAPIRoute {
	public schema = {
		tags: ["Local Agent"],
		summary: "The agent reports a task's outcome — done, failed, or refused",
		request: {
			body: contentJson(
				z.object({
					secret: z.string().default(""),
					id: z.number().int().positive(),
					status: z.enum(["done", "failed", "refused"]),
					result: z.string().max(4000).default(""),
				}),
			),
		},
		responses: {
			"200": { description: "The updated task", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Unknown task" },
			"401": { description: "Bad agent secret" },
			"503": { description: "Local agent disabled" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const denied = await gate(c, body.secret);
		if (denied) return denied;
		const res = await completeTask(c.env.DB, body.id, body.status, body.result);
		if ("error" in res) {
			return c.json({ success: false, errors: [{ code: 4043, message: res.error }] }, 400);
		}
		return { success: true, result: res };
	}
}
