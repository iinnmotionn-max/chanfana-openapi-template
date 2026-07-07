// Aether token endpoints: the AI-credit ledger the colony runs on.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { auditSupply, reward, spend, tokenOverview, transfer } from "../engine/token";
import { suiChainStatus } from "../engine/sui";

export class AetherOverview extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "Aether token: supply, treasury, account balances, and recent ledger",
		responses: {
			"200": { description: "Token overview", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const overview = await tokenOverview(c.env.DB);
		return { success: true, result: { ...overview, chainLink: suiChainStatus(c.env) } };
	}
}

export class AetherChain extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "Sui on-chain link status for the AETHER token",
		responses: {
			"200": { description: "Chain status", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: suiChainStatus(c.env) };
	}
}

export class AetherLedger extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "The Aether transaction ledger, newest first",
		request: { query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }) },
		responses: {
			"200": { description: "Ledger", ...contentJson({ success: z.boolean(), result: z.array(z.any()) }) },
		},
	};

	public async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const { results } = await c.env.DB.prepare("SELECT * FROM aether_ledger ORDER BY id DESC LIMIT ?").bind(query.limit).all();
		return { success: true, result: results };
	}
}

export class AetherTransfer extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "Transfer Aether between accounts",
		request: {
			body: contentJson(
				z.object({
					from: z.string().min(1),
					to: z.string().min(1),
					amount: z.number().positive(),
					memo: z.string().max(200).default(""),
				}),
			),
		},
		responses: {
			"200": { description: "The recorded transfer", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected (unknown account, insufficient balance, …)" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await transfer(c.env.DB, body.from, body.to, body.amount, "transfer", body.memo);
		if ("error" in result) return c.json({ success: false, errors: [{ code: 4009, message: result.error }] }, 400);
		return { success: true, result };
	}
}

export class AetherReward extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "Reward Aether credits from the treasury to an account",
		request: {
			body: contentJson(
				z.object({ to: z.string().min(1), amount: z.number().positive(), reason: z.string().max(200).default("reward") }),
			),
		},
		responses: { "200": { description: "Token overview after reward", ...contentJson({ success: z.boolean(), result: z.any() }) } },
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		await reward(c.env.DB, body.to, body.amount, body.reason);
		return { success: true, result: await tokenOverview(c.env.DB) };
	}
}

export class AetherSpend extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "Spend Aether credits (account → treasury) for AI work",
		request: {
			body: contentJson(
				z.object({ from: z.string().min(1), amount: z.number().positive(), reason: z.string().max(200).default("spend") }),
			),
		},
		responses: {
			"200": { description: "The recorded spend", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Insufficient credits or unknown account" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await spend(c.env.DB, body.from, body.amount, body.reason);
		if ("error" in result) return c.json({ success: false, errors: [{ code: 4009, message: result.error }] }, 400);
		return { success: true, result };
	}
}

export class AetherAudit extends OpenAPIRoute {
	public schema = {
		tags: ["Aether"],
		summary: "Supply integrity: balances reconcile to the genesis supply",
		responses: { "200": { description: "Audit result", ...contentJson({ success: z.boolean(), result: z.any() }) } },
	};

	public async handle(c: AppContext) {
		const check = await auditSupply(c.env.DB);
		return { success: true, result: check };
	}
}
