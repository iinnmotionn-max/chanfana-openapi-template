// The Risk realm: colony-level drawdown / exposure gates with a global halt.
// Reg reads and trips these limits; the creator halts, resumes, and tunes them.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { getRisk, setHalt } from "../engine/risk";

export class RiskStatusEndpoint extends OpenAPIRoute {
	public schema = {
		tags: ["Risk"],
		summary: "Colony risk status: drawdown, open exposure, limits, and halt state",
		responses: {
			"200": {
				description: "Risk status",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await getRisk(c.env.DB) };
	}
}

export class RiskHalt extends OpenAPIRoute {
	public schema = {
		tags: ["Risk"],
		summary: "Engage the global trading halt",
		request: {
			body: contentJson(
				z.object({
					reason: z.string().max(200).default("manual halt"),
				}),
			),
		},
		responses: {
			"200": {
				description: "Risk status after halting",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const db = c.env.DB;
		await setHalt(db, true, body.reason);
		return { success: true, result: await getRisk(db) };
	}
}

export class RiskResume extends OpenAPIRoute {
	public schema = {
		tags: ["Risk"],
		summary: "Lift the global trading halt",
		request: {
			body: contentJson(
				z.object({
					reason: z.string().max(200).default("manual resume"),
				}),
			),
		},
		responses: {
			"200": {
				description: "Risk status after resuming",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const db = c.env.DB;
		await setHalt(db, false, body.reason);
		return { success: true, result: await getRisk(db) };
	}
}

export class RiskConfig extends OpenAPIRoute {
	public schema = {
		tags: ["Risk"],
		summary: "Tune the colony risk limits",
		request: {
			body: contentJson(
				z.object({
					maxDrawdown: z.number().min(0).max(1).optional(),
					maxOpenPositions: z.number().int().min(1).optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Risk status after tuning",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const db = c.env.DB;
		const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
		const binds: unknown[] = [];
		if (body.maxDrawdown !== undefined) {
			sets.push("max_drawdown = ?");
			binds.push(body.maxDrawdown);
		}
		if (body.maxOpenPositions !== undefined) {
			sets.push("max_open_positions = ?");
			binds.push(body.maxOpenPositions);
		}
		if (binds.length > 0) {
			await db
				.prepare(`UPDATE risk_config SET ${sets.join(", ")} WHERE id = 1`)
				.bind(...binds)
				.run();
		}
		return { success: true, result: await getRisk(db) };
	}
}
