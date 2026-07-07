import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { colonyDna } from "../engine/learning";

const botWithStats = z.object({
	id: z.number(),
	name: z.string(),
	soul: z.any(),
	strategy_id: z.number(),
	strategy: z.string(),
	symbol: z.string(),
	balance: z.number(),
	starting_balance: z.number(),
	status: z.string(),
	closed: z.number(),
	wins: z.number(),
	losses: z.number(),
	winRate: z.number(),
});

const BOT_STATS_SQL = `
	SELECT b.id, b.name, b.soul, b.strategy_id, s.name as strategy, b.symbol,
	       b.balance, b.starting_balance, b.status,
	       COUNT(t.id) as closed,
	       SUM(CASE WHEN t.outcome = 'win' THEN 1 ELSE 0 END) as wins,
	       SUM(CASE WHEN t.outcome = 'loss' THEN 1 ELSE 0 END) as losses
	FROM bots b
	JOIN strategies s ON s.id = b.strategy_id
	LEFT JOIN trades t ON t.bot_id = b.id AND t.outcome != 'open'
	GROUP BY b.id ORDER BY b.balance DESC`;

export function decorateBot<T extends Record<string, unknown>>(row: T) {
	const closed = Number(row.closed ?? 0);
	const wins = Number(row.wins ?? 0);
	return {
		...row,
		soul: JSON.parse(String(row.soul || "{}")),
		closed,
		wins,
		losses: Number(row.losses ?? 0),
		winRate: closed > 0 ? wins / closed : 0,
	};
}

export class BotsList extends OpenAPIRoute {
	public schema = {
		tags: ["Bots"],
		summary: "All bots with live performance stats",
		responses: {
			"200": {
				description: "Bots with stats",
				...contentJson({ success: z.boolean(), result: z.array(botWithStats) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare(BOT_STATS_SQL).all();
		return { success: true, result: results.map(decorateBot) };
	}
}

export class BotUpdate extends OpenAPIRoute {
	public schema = {
		tags: ["Bots"],
		summary: "Creator control: pause, resume, or retire a bot",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
			body: contentJson(
				z.object({
					status: z.enum(["active", "paused", "retired"]),
				}),
			),
		},
		responses: {
			"200": {
				description: "The updated bot",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
			"404": { description: "Bot not found" },
		},
	};

	public async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		const bot = await c.env.DB.prepare("UPDATE bots SET status = ? WHERE id = ? RETURNING *")
			.bind(body.status, params.id)
			.first();
		if (!bot) return c.json({ success: false, errors: [{ code: 4041, message: "Not Found" }] }, 404);
		await c.env.DB.prepare(
			"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'command', ?, ?, ?, 'invest')",
		)
			.bind(
				`Creator command: ${String(bot.name)} ${body.status}`,
				`The creator set bot "${String(bot.name)}" to ${body.status}.`,
				JSON.stringify({ botId: params.id, status: body.status }),
			)
			.run();
		return { success: true, result: bot };
	}
}

export class BotCreate extends OpenAPIRoute {
	public schema = {
		tags: ["Bots"],
		summary: "Create a bot (inherits colony DNA unless a soul is given)",
		request: {
			body: contentJson(
				z.object({
					name: z.string().min(1),
					strategy_id: z.number().int(),
					symbol: z.string().default("SIM-BTC"),
					balance: z.number().positive().default(1000),
					soul: z.record(z.number()).optional(),
				}),
			),
		},
		responses: {
			"201": {
				description: "The created bot",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
			"400": { description: "Unknown strategy or invalid input" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const strategy = await c.env.DB.prepare("SELECT id FROM strategies WHERE id = ? AND status = 'active'")
			.bind(body.strategy_id)
			.first();
		if (!strategy) {
			return c.json({ success: false, errors: [{ code: 4004, message: "Unknown or retired strategy" }] }, 400);
		}
		const soul = body.soul ?? (await colonyDna(c.env.DB));
		const bot = await c.env.DB.prepare(
			"INSERT INTO bots (name, soul, strategy_id, symbol, balance, starting_balance) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
		)
			.bind(body.name, JSON.stringify(soul), body.strategy_id, body.symbol, body.balance, body.balance)
			.first();
		return c.json({ success: true, result: { ...bot, soul } }, 201);
	}
}
