// Aether's schoolroom for the Invest realm: Lumi and Aether study a trading
// curriculum. Each lesson is banked in the knowledge bank and makes Lumi
// sharper (Insight XP) while Aether's scholarship deepens. Lessons come with
// built-in summaries so studying works even offline; when the network is
// reachable, each lesson is enriched with real sources from the Hugging Face
// Hub. Everything here is scoped to the Invest realm.

import { awardXp } from "./lumi";

export interface Lesson {
	title: string;
	summary: string;
}

// A systematic trading curriculum — the "science of trades".
export const CURRICULUM: Lesson[] = [
	{ title: "Trend following", summary: "Ride sustained moves; cut losers fast, let winners run. Edge comes from a few large wins." },
	{ title: "Mean reversion", summary: "Fade stretched moves back toward a fair value; works in range regimes, dangerous in trends." },
	{ title: "Position sizing & risk of ruin", summary: "Bet a small fraction of capital per trade so a losing streak can never wipe the account." },
	{ title: "Expectancy & profit factor", summary: "Edge = winRate·avgWin − lossRate·avgLoss. Profit factor >1 is survival; the payoff ratio matters more than hit rate." },
	{ title: "Market regimes & volatility", summary: "Trend, range, and chop demand different tactics; size down when volatility spikes." },
	{ title: "Overfitting & walk-forward validation", summary: "A backtest that's too perfect is a curve fit; validate out-of-sample before trusting an edge." },
	{ title: "Drawdown & recovery math", summary: "A 50% loss needs a 100% gain to recover; protecting capital beats chasing returns." },
	{ title: "Momentum & breakouts", summary: "Enter as price clears a range on expansion; false breakouts are the cost of catching real ones." },
];

export interface StudyResult {
	topic: string;
	summary: string;
	lessonsStudied: number;
	curriculumTotal: number;
	aetherScholarship: number;
	enriched: number;
	complete: boolean;
	note: string;
}

const FETCH_TIMEOUT_MS = 8000;

// Best-effort enrichment: pull a couple of real sources for the topic from the
// Hugging Face Hub and bank them. Degrades silently offline.
async function enrichFromHub(db: D1Database, topic: string): Promise<number> {
	try {
		const res = await fetch(
			`https://huggingface.co/api/datasets?search=${encodeURIComponent("trading " + topic)}&limit=3&sort=downloads`,
			{ headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
		);
		if (!res.ok) return 0;
		const items = (await res.json()) as { id: string; downloads?: number }[];
		let n = 0;
		for (const item of items) {
			const dupe = await db
				.prepare("SELECT id FROM knowledge WHERE source = 'huggingface' AND title = ? LIMIT 1")
				.bind(item.id)
				.first();
			if (dupe) continue;
			await db
				.prepare("INSERT INTO knowledge (source, kind, title, url, detail, data) VALUES ('huggingface', 'lesson-source', ?, ?, ?, ?)")
				.bind(item.id, `https://huggingface.co/datasets/${item.id}`, `source for "${topic}"`, JSON.stringify({ topic }))
				.run();
			n++;
		}
		return n;
	} catch {
		return 0;
	}
}

// Run one study session: Lumi + Aether study the next unlearned lesson.
export async function runStudy(db: D1Database): Promise<StudyResult> {
	const studied = (
		await db.prepare("SELECT title FROM knowledge WHERE kind = 'lesson'").all<{ title: string }>()
	).results.map((r) => r.title);
	const studiedSet = new Set(studied);
	const next = CURRICULUM.find((l) => !studiedSet.has(l.title));

	if (!next) {
		// Curriculum finished — Aether reinforces, Lumi keeps a little Insight.
		await awardXp(db, "insight", 6, "Curriculum review");
		await db.prepare("UPDATE agents SET last_seen = CURRENT_TIMESTAMP WHERE name = 'aether'").run();
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('aether', 'study', 'Curriculum complete', ?, ?, 'invest')")
			.bind(`Aether has taught all ${CURRICULUM.length} lessons; reviewing to keep the edge sharp.`, JSON.stringify({ complete: true }))
			.run();
		return {
			topic: "review",
			summary: "All lessons taught — reviewing.",
			lessonsStudied: CURRICULUM.length,
			curriculumTotal: CURRICULUM.length,
			aetherScholarship: CURRICULUM.length,
			enriched: 0,
			complete: true,
			note: "curriculum complete",
		};
	}

	await db
		.prepare("INSERT INTO knowledge (source, kind, title, url, detail, data) VALUES ('curriculum', 'lesson', ?, '', ?, ?)")
		.bind(next.title, next.summary, JSON.stringify({ realm: "invest" }))
		.run();

	const enriched = await enrichFromHub(db, next.title);
	const lessonsStudied = studied.length + 1;

	// Lumi grows sharper; Aether's scholarship is the count of lessons taught.
	await awardXp(db, "insight", 12 + Math.min(6, enriched * 2), `Studied "${next.title}"`);
	await db.prepare("UPDATE agents SET last_seen = CURRENT_TIMESTAMP WHERE name = 'aether'").run();
	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('aether', 'study', ?, ?, ?, 'invest')")
		.bind(
			`Lesson: ${next.title}`,
			`${next.summary}${enriched > 0 ? ` (+${enriched} real sources banked)` : ""} — Lumi & Aether trained.`,
			JSON.stringify({ topic: next.title, enriched, lessonsStudied }),
		)
		.run();

	return {
		topic: next.title,
		summary: next.summary,
		lessonsStudied,
		curriculumTotal: CURRICULUM.length,
		aetherScholarship: lessonsStudied,
		enriched,
		complete: lessonsStudied >= CURRICULUM.length,
		note: enriched > 0 ? `banked ${enriched} real sources` : "studied (offline)",
	};
}

// Curriculum progress for the cockpit.
export async function curriculumStatus(db: D1Database) {
	const studied = new Set(
		(await db.prepare("SELECT title FROM knowledge WHERE kind = 'lesson'").all<{ title: string }>()).results.map((r) => r.title),
	);
	const scholarship = (await db.prepare("SELECT last_seen FROM agents WHERE name = 'aether'").first<{ last_seen: string | null }>()) ?? null;
	return {
		total: CURRICULUM.length,
		studied: studied.size,
		aetherLastSeen: scholarship?.last_seen ?? null,
		lessons: CURRICULUM.map((l) => ({ title: l.title, summary: l.summary, studied: studied.has(l.title) })),
	};
}
