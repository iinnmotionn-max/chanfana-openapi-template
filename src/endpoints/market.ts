// Market feed control: see each symbol's tape and switch it between the
// deterministic sim feed and the live (real-observation replay) feed.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { setFeedMode } from "../engine/feed";

export class MarketList extends OpenAPIRoute {
	public schema = {
		tags: ["Market"],
		summary: "Every market symbol with its tick, price, and feed mode",
		responses: {
			"200": {
				description: "Markets",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const [markets, liveCounts] = await Promise.all([
			c.env.DB.prepare("SELECT symbol, tick, price, feed FROM market_state ORDER BY symbol").all(),
			c.env.DB.prepare("SELECT symbol, COUNT(*) as n FROM live_ticks GROUP BY symbol").all<{ symbol: string; n: number }>(),
		]);
		const live = new Map(liveCounts.results.map((r) => [r.symbol, r.n]));
		return {
			success: true,
			result: markets.results.map((m) => ({ ...m, liveObservations: live.get(String(m.symbol)) ?? 0 })),
		};
	}
}

export class MarketFeed extends OpenAPIRoute {
	public schema = {
		tags: ["Market"],
		summary: "Switch a symbol between the sim feed and the live feed",
		request: {
			body: contentJson(
				z.object({
					symbol: z.string().min(1),
					mode: z.enum(["sim", "live"]),
				}),
			),
		},
		responses: {
			"200": {
				description: "The updated market row",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
			"404": { description: "Unknown symbol (no market yet — trade it once first)" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const existing = await c.env.DB.prepare("SELECT symbol FROM market_state WHERE symbol = ?")
			.bind(body.symbol)
			.first();
		if (!existing) {
			return c.json(
				{ success: false, errors: [{ code: 4044, message: "Unknown symbol — run a cycle for a bot on it first" }] },
				404,
			);
		}
		await setFeedMode(c.env.DB, body.symbol, body.mode);
		const market = await c.env.DB.prepare("SELECT symbol, tick, price, feed FROM market_state WHERE symbol = ?")
			.bind(body.symbol)
			.first();
		await c.env.DB.prepare(
			"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'command', ?, ?, ?, 'tech')",
		)
			.bind(
				`Feed switched: ${body.symbol} → ${body.mode}`,
				`The creator set ${body.symbol} to the ${body.mode} feed.`,
				JSON.stringify({ symbol: body.symbol, mode: body.mode }),
			)
			.run();
		return { success: true, result: market };
	}
}
