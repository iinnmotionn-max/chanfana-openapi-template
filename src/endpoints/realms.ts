// The creator realms: Lumi's view over everything Reg runs. Invest audits,
// Guardian sweeps, Tech diagnostics, and Wellness check-ins — all backed by
// the same Databank.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { auditInvest, recordAudit } from "../engine/integrity";
import { EXPECTED_TABLES, runSweep } from "../engine/guardian";

interface RealmRow {
	id: number;
	key: string;
	title: string;
	mission: string;
	status: string;
	updated_at: string | null;
}

// Realms with their latest check and open-goal count. Shared with analytics
// so the dashboard sees exactly what GET /realms returns.
export async function realmsOverview(db: D1Database) {
	const [realms, latestChecks, openGoals] = await Promise.all([
		db.prepare("SELECT * FROM realms ORDER BY id").all<RealmRow>(),
		db
			.prepare(
				`SELECT c.realm, c.name, c.status, c.created_at
				 FROM checks c
				 JOIN (SELECT realm, MAX(id) as mid FROM checks GROUP BY realm) m ON m.mid = c.id`,
			)
			.all<{ realm: string; name: string; status: string; created_at: string }>(),
		db
			.prepare("SELECT realm, COUNT(*) as n FROM goals WHERE status != 'done' GROUP BY realm")
			.all<{ realm: string; n: number }>(),
	]);
	return realms.results.map((r) => {
		const check = latestChecks.results.find((c) => c.realm === r.key);
		return {
			...r,
			latestCheck: check ? { name: check.name, status: check.status, created_at: check.created_at } : null,
			openGoals: openGoals.results.find((g) => g.realm === r.key)?.n ?? 0,
		};
	});
}

// Wellness stats shared with analytics: latest check-in, total count, and the
// 7-day mood/energy average.
export async function wellnessStats(db: D1Database) {
	const [last, count, avg] = await Promise.all([
		db.prepare("SELECT * FROM wellness_checkins ORDER BY id DESC LIMIT 1").first(),
		db.prepare("SELECT COUNT(*) as n FROM wellness_checkins").first<{ n: number }>(),
		db
			.prepare(
				"SELECT AVG(mood) as mood, AVG(energy) as energy, COUNT(*) as n FROM wellness_checkins WHERE created_at >= datetime('now', '-7 days')",
			)
			.first<{ mood: number | null; energy: number | null; n: number }>(),
	]);
	return {
		last: last ?? null,
		count: count?.n ?? 0,
		avg7: avg && avg.n > 0 ? { mood: Number(avg.mood), energy: Number(avg.energy) } : null,
	};
}

export class RealmsList extends OpenAPIRoute {
	public schema = {
		tags: ["Realms"],
		summary: "All creator realms with latest check and open-goal count",
		responses: {
			"200": {
				description: "Realms",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await realmsOverview(c.env.DB) };
	}
}

export class InvestAudit extends OpenAPIRoute {
	public schema = {
		tags: ["Realms"],
		summary: "Audit the Invest ledger from raw trade evidence and record the result",
		responses: {
			"200": {
				description: "Audit result",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const audit = await auditInvest(c.env.DB);
		await recordAudit(c.env.DB, audit);
		return { success: true, result: audit };
	}
}

export class GuardianSweep extends OpenAPIRoute {
	public schema = {
		tags: ["Realms"],
		summary: "Run the Guardian protection sweep: databank, ledger, privacy, agents, market",
		responses: {
			"200": {
				description: "Sweep result",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const sweep = await runSweep(c.env.DB);
		return { success: true, result: sweep };
	}
}

export class TechStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Realms"],
		summary: "Tech realm diagnostics: table counts, market tick, active fleet, realm statuses",
		responses: {
			"200": {
				description: "Diagnostics",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const db = c.env.DB;

		const countResults = await db.batch<{ n: number }>(
			EXPECTED_TABLES.map((t) => db.prepare(`SELECT COUNT(*) as n FROM ${t}`)),
		);
		const tables: Record<string, number> = {};
		EXPECTED_TABLES.forEach((t, i) => {
			tables[t] = countResults[i].results[0]?.n ?? 0;
		});

		const [market, activeBots, activeStrategies, lastReport, realmRows] = await Promise.all([
			db.prepare("SELECT MAX(tick) as t FROM market_state").first<{ t: number | null }>(),
			db.prepare("SELECT COUNT(*) as n FROM bots WHERE status = 'active'").first<{ n: number }>(),
			db.prepare("SELECT COUNT(*) as n FROM strategies WHERE status = 'active'").first<{ n: number }>(),
			db.prepare("SELECT title, created_at FROM reports ORDER BY id DESC LIMIT 1").first<{ title: string; created_at: string }>(),
			db.prepare("SELECT key, status FROM realms").all<{ key: string; status: string }>(),
		]);

		await db.prepare("UPDATE realms SET updated_at = CURRENT_TIMESTAMP WHERE key = 'tech'").run();

		return {
			success: true,
			result: {
				tables,
				marketTick: market?.t ?? 0,
				activeBots: activeBots?.n ?? 0,
				activeStrategies: activeStrategies?.n ?? 0,
				lastReport: lastReport ?? null,
				realmStatuses: Object.fromEntries(realmRows.results.map((r) => [r.key, r.status])),
			},
		};
	}
}

export class WellnessSummary extends OpenAPIRoute {
	public schema = {
		tags: ["Realms"],
		summary: "Wellness realm: latest check-in, totals, 7-day averages, recent history",
		responses: {
			"200": {
				description: "Wellness summary",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const db = c.env.DB;
		const [stats, recent] = await Promise.all([
			wellnessStats(db),
			db.prepare("SELECT * FROM wellness_checkins ORDER BY id DESC LIMIT 10").all(),
		]);
		return { success: true, result: { ...stats, recent: recent.results } };
	}
}

export class WellnessCheckin extends OpenAPIRoute {
	public schema = {
		tags: ["Realms"],
		summary: "Log a creator check-in: mood and energy on a 1-5 scale",
		request: {
			body: contentJson(
				z.object({
					mood: z.number().int().min(1).max(5),
					energy: z.number().int().min(1).max(5),
					note: z.string().max(500).default(""),
				}),
			),
		},
		responses: {
			"201": {
				description: "The recorded check-in",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const db = c.env.DB;
		const checkin = await db
			.prepare("INSERT INTO wellness_checkins (mood, energy, note) VALUES (?, ?, ?) RETURNING *")
			.bind(body.mood, body.energy, body.note)
			.first();
		await db.batch([
			db
				.prepare(
					"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'wellness', 'Creator check-in', ?, ?, 'wellness')",
				)
				.bind(`mood ${body.mood}/5, energy ${body.energy}/5`, JSON.stringify({ mood: body.mood, energy: body.energy })),
			db.prepare(
				"UPDATE goals SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE title = 'Creator check-in streak'",
			),
		]);
		return c.json({ success: true, result: checkin }, 201);
	}
}
