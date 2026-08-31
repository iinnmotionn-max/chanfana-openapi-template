// Read endpoints over the Databank: strategies, trades, reports.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";

export class StrategiesList extends OpenAPIRoute {
	public schema = {
		tags: ["Strategies"],
		summary: "Strategies with lineage and trade evidence",
		responses: {
			"200": {
				description: "Strategies",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare(
			`SELECT s.id, s.name, s.kind, s.params, s.generation, s.parent_id, s.status,
			        COUNT(t.id) as closed,
			        SUM(CASE WHEN t.outcome = 'win' THEN 1 ELSE 0 END) as wins,
			        COALESCE(SUM(t.pnl), 0) as totalPnl
			 FROM strategies s
			 LEFT JOIN trades t ON t.strategy_id = s.id AND t.outcome != 'open'
			 GROUP BY s.id ORDER BY s.status = 'active' DESC, totalPnl DESC`,
		).all();
		return {
			success: true,
			result: results.map((s) => ({
				...s,
				params: JSON.parse(String(s.params)),
				winRate: Number(s.closed) > 0 ? Number(s.wins) / Number(s.closed) : 0,
			})),
		};
	}
}

export class TradesList extends OpenAPIRoute {
	public schema = {
		tags: ["Trades"],
		summary: "Trade history, newest first",
		request: {
			query: z.object({
				bot_id: z.coerce.number().int().optional(),
				limit: z.coerce.number().int().min(1).max(500).default(50),
			}),
		},
		responses: {
			"200": {
				description: "Trades",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const stmt = query.bot_id
			? c.env.DB.prepare("SELECT * FROM trades WHERE bot_id = ? ORDER BY id DESC LIMIT ?").bind(query.bot_id, query.limit)
			: c.env.DB.prepare("SELECT * FROM trades ORDER BY id DESC LIMIT ?").bind(query.limit);
		const { results } = await stmt.all();
		return { success: true, result: results };
	}
}

export class ReportsList extends OpenAPIRoute {
	public schema = {
		tags: ["Reports"],
		summary: "Observer/Reporter feed, newest first",
		request: {
			query: z.object({
				limit: z.coerce.number().int().min(1).max(200).default(30),
			}),
		},
		responses: {
			"200": {
				description: "Reports",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const { results } = await c.env.DB.prepare("SELECT * FROM reports ORDER BY id DESC LIMIT ?").bind(query.limit).all();
		return { success: true, result: results.map((r) => ({ ...r, data: JSON.parse(String(r.data)) })) };
	}
}
