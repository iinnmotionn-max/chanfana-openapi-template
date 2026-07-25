// Total Command API — one bar, all control. GET lists every capability and the
// authority ledger; POST speaks an order; PATCH grants or revokes a scope.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { command, commandOverview, setAuthority } from "../engine/command";

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
			body: contentJson(z.object({ order: z.string().min(1).max(2000) })),
		},
		responses: {
			"200": { description: "What she did (or why she refused)", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return { success: true, result: await command(c.env.DB, c.env, body.order) };
	}
}

export class AuthorityGrant extends OpenAPIRoute {
	public schema = {
		tags: ["Command"],
		summary: "Grant or revoke one of Lumi's authority scopes",
		request: {
			body: contentJson(z.object({ scope: z.string().min(1).max(20), granted: z.boolean() })),
		},
		responses: {
			"200": { description: "The updated scope", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Unknown scope" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const res = await setAuthority(c.env.DB, body.scope, body.granted);
		if ("error" in res) {
			return c.json({ success: false, errors: [{ code: 4006, message: res.error }] }, 400);
		}
		return { success: true, result: res };
	}
}
