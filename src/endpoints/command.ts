// Total Command API — one bar, all control. GET lists every capability and the
// authority ledger; POST speaks an order; PATCH grants or revokes a scope.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { command, commandOverview, setAuthority } from "../engine/command";
import { creatorKeySet, isCreator, KEY_WRONG_NOTE } from "../engine/creator";
import { consume, LIMITS } from "../engine/ratelimit";

// The creator key travels in a header (the cockpit) or the body (a curl
// one-liner). A WRONG key is refused outright — sending the wrong key is a
// mistake worth surfacing, unlike sending none, which just means "I'm only
// asking for the open half".
function creatorCheck(c: AppContext, bodyKey: string): { creator: boolean; wrong: boolean } {
	const provided = c.req.header("X-Creator-Key") || bodyKey || "";
	if (!provided) return { creator: false, wrong: false };
	if (!creatorKeySet(c.env)) return { creator: false, wrong: true };
	return { creator: isCreator(c.env, provided), wrong: !isCreator(c.env, provided) };
}

export class CommandStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Command"],
		summary: "Every capability Lumi can exercise + the authority ledger",
		responses: {
			"200": { description: "Capabilities + authority", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await commandOverview(c.env.DB) };
	}
}

export class CommandSpeak extends OpenAPIRoute {
	public schema = {
		tags: ["Command"],
		summary: "Give Lumi a plain-English order; she routes, checks her grant, acts",
		request: {
			body: contentJson(z.object({ order: z.string().min(1).max(2000), key: z.string().max(200).default("") })),
		},
		responses: {
			"200": { description: "What she did (or why she refused)", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const { creator, wrong } = creatorCheck(c, body.key);
		if (wrong) {
			return c.json({ success: false, errors: [{ code: 4013, message: KEY_WRONG_NOTE }] }, 401);
		}
		// The command bar is driven by hand; this cap only bites a script.
		const called = await consume(c.env.DB, "call:command", LIMITS.command.limit, LIMITS.command.window);
		if (!called.ok) {
			return c.json({ success: false, errors: [{ code: 4291, message: `Rate limit exceeded — retry in ${called.retryAfter}s` }] }, 429, {
				"Retry-After": String(called.retryAfter),
			});
		}
		return { success: true, result: await command(c.env.DB, c.env, body.order, creator) };
	}
}

export class AuthorityGrant extends OpenAPIRoute {
	public schema = {
		tags: ["Command"],
		summary: "Grant or revoke one of Lumi's authority scopes",
		request: {
			body: contentJson(z.object({ scope: z.string().min(1).max(20), granted: z.boolean(), key: z.string().max(200).default("") })),
		},
		responses: {
			"200": { description: "The updated scope", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Unknown scope" },
			"401": { description: "Wrong creator key" },
			"403": { description: "Granting a guarded scope requires the creator key" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const { creator, wrong } = creatorCheck(c, body.key);
		if (wrong) {
			return c.json({ success: false, errors: [{ code: 4013, message: KEY_WRONG_NOTE }] }, 401);
		}
		const res = await setAuthority(c.env.DB, body.scope, body.granted, creator);
		if ("error" in res) {
			// 403 when it is a permission problem, 400 when the scope is nonsense.
			return c.json({ success: false, errors: [{ code: res.needsKey ? 4033 : 4006, message: res.error }] }, res.needsKey ? 403 : 400);
		}
		return { success: true, result: res };
	}
}
