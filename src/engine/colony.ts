// Births the starter colony: one generation-1 strategy of each kind, one bot
// per strategy carrying the merged colony DNA. Idempotent — safe to call twice.

import { colonyDna } from "./learning";
import { DEFAULT_PARAMS, STRATEGY_KINDS } from "./strategies";

export interface SeedResult {
	created: boolean;
	strategies: number;
	bots: number;
}

export async function seedColony(db: D1Database): Promise<SeedResult> {
	const existing = await db.prepare("SELECT COUNT(*) as n FROM strategies").first<{ n: number }>();
	if ((existing?.n ?? 0) > 0) {
		const bots = await db.prepare("SELECT COUNT(*) as n FROM bots").first<{ n: number }>();
		return { created: false, strategies: existing!.n, bots: bots?.n ?? 0 };
	}

	const soul = JSON.stringify(await colonyDna(db));
	let strategies = 0;
	let bots = 0;
	for (const kind of STRATEGY_KINDS) {
		const strategy = await db
			.prepare("INSERT INTO strategies (name, kind, params) VALUES (?, ?, ?) RETURNING id")
			.bind(kind.replace(/_/g, " "), kind, JSON.stringify(DEFAULT_PARAMS[kind]))
			.first<{ id: number }>();
		strategies++;
		await db
			.prepare("INSERT INTO bots (name, soul, strategy_id) VALUES (?, ?, ?)")
			.bind(`${kind.replace(/_/g, "-")}-1`, soul, strategy!.id)
			.run();
		bots++;
	}

	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'milestone', ?, ?, ?, 'invest')")
		.bind(
			"Colony born",
			`Seeded ${strategies} generation-1 strategies with ${bots} bots carrying merged colony DNA.`,
			JSON.stringify({ strategies, bots }),
		)
		.run();

	return { created: true, strategies, bots };
}
