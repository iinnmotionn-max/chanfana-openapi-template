// The Observer scores every strategy on its real trade history; the colony
// then retires losers, reassigns their bots to the champion, and evolves the
// champion into a new generation. The Reporter files what happened.

import { mulberry32 } from "./market";
import { mutateParams, StrategyParams } from "./strategies";

export interface StrategyScore {
	strategyId: number;
	name: string;
	kind: string;
	generation: number;
	closed: number;
	wins: number;
	losses: number;
	winRate: number;
	totalPnl: number;
	profitFactor: number;
	expectancy: number; // average PnL per closed trade — negative means it loses money
	score: number;
}

export interface LearnResult {
	scores: StrategyScore[];
	retired: number[];
	reassignedBots: number;
	evolved: { fromStrategyId: number; newStrategyId: number; newBotId: number } | null;
	brood: number;
	overallWinRate: number;
}

const MIN_TRADES = 8; // evidence required before judging a strategy
const SCORE_FLOOR = 0.35; // below this (with evidence), a strategy is retired
const PF_CAP = 3;
// What a newly bred child is funded with, against a founder's 1000.
//
// Children were staked at a full 1000 — the same as a strategy with hundreds
// of closed trades behind it. So every mutation, proven or not, immediately
// carried a founder's weight in the colony's results, and exploration diluted
// the very returns it was meant to improve. A child is a hypothesis; it should
// be funded like one, and grow through the compounding that already exists if
// the evidence arrives.
const CHILD_STAKE = 250;

// opts.insight is Lumi's Insight skill level: it widens mutation spread and
// lets the champion breed a larger brood — her learning literally deepens as
// she levels up.
export async function runLearning(db: D1Database, opts: { insight?: number } = {}): Promise<LearnResult> {
	const insight = Math.max(1, opts.insight ?? 1);
	const rows = (
		await db
			.prepare(
				`SELECT s.id as strategyId, s.name, s.kind, s.generation, s.params,
				        COUNT(t.id) as closed,
				        SUM(CASE WHEN t.outcome = 'win' THEN 1 ELSE 0 END) as wins,
				        SUM(CASE WHEN t.outcome = 'loss' THEN 1 ELSE 0 END) as losses,
				        COALESCE(SUM(t.pnl), 0) as totalPnl,
				        COALESCE(SUM(CASE WHEN t.pnl > 0 THEN t.pnl ELSE 0 END), 0) as grossWin,
				        COALESCE(SUM(CASE WHEN t.pnl < 0 THEN -t.pnl ELSE 0 END), 0) as grossLoss
				 FROM strategies s
				 LEFT JOIN trades t ON t.strategy_id = s.id AND t.outcome != 'open'
				 WHERE s.status = 'active'
				 GROUP BY s.id`,
			)
			.all<{
				strategyId: number;
				name: string;
				kind: string;
				generation: number;
				params: string;
				closed: number;
				wins: number;
				losses: number;
				totalPnl: number;
				grossWin: number;
				grossLoss: number;
			}>()
	).results;

	const scores: StrategyScore[] = rows.map((r) => {
		const winRate = r.closed > 0 ? r.wins / r.closed : 0;
		const profitFactor = r.grossLoss > 0 ? Math.min(r.grossWin / r.grossLoss, PF_CAP) : r.grossWin > 0 ? PF_CAP : 0;
		// Expectancy — average PnL per closed trade. This is the number that
		// actually says whether a strategy makes money, and it was not being
		// scored at all.
		const expectancy = r.closed > 0 ? r.totalPnl / r.closed : 0;
		// Payoff, anchored at BREAK-EVEN rather than at zero. Dividing profit
		// factor by the cap meant a break-even strategy (PF 1.0) still earned a
		// third of the payoff half — enough that a high hit rate could carry a
		// strategy that loses money over the retirement floor. It did exactly
		// that: "mean reversion" held the best win rate in the colony (58%) and
		// the worst expectancy (-0.25/trade), and survived every learning pass.
		// Break-even now earns nothing, because breaking even is not a payoff.
		const payoff = Math.max(0, Math.min(1, (profitFactor - 1) / (PF_CAP - 1)));
		const score = winRate * 0.5 + payoff * 0.5;
		return {
			strategyId: r.strategyId,
			name: r.name,
			kind: r.kind,
			generation: r.generation,
			closed: r.closed,
			wins: r.wins,
			losses: r.losses,
			winRate,
			totalPnl: r.totalPnl,
			profitFactor,
			expectancy,
			score,
		};
	});

	const judged = scores.filter((s) => s.closed >= MIN_TRADES);
	const champion = judged.length > 0 ? judged.reduce((a, b) => (b.score > a.score ? b : a)) : null;
	// Two ways to be retired, and the second is absolute: a strategy that loses
	// money on average is a losing strategy, however often it is right. No
	// blend of metrics should be able to argue with a negative expectancy.
	//
	// The champion is never retired — the colony must always have something to
	// trade. If the champion itself has negative expectancy that is a fact
	// about the whole colony, and the report says so rather than emptying it.
	const toRetire = judged.filter(
		(s) => (s.score < SCORE_FLOOR || s.expectancy < 0) && s.strategyId !== champion?.strategyId,
	);

	const result: LearnResult = {
		scores,
		retired: toRetire.map((s) => s.strategyId),
		reassignedBots: 0,
		evolved: null,
		brood: 0,
		overallWinRate: totalWinRate(scores),
	};

	// Retire the losers; move their bots onto the champion so capital keeps working.
	if (toRetire.length > 0 && champion) {
		const ids = toRetire.map((s) => s.strategyId);
		const placeholders = ids.map(() => "?").join(",");
		await db.prepare(`UPDATE strategies SET status = 'retired' WHERE id IN (${placeholders})`).bind(...ids).run();
		const moved = await db
			.prepare(`UPDATE bots SET strategy_id = ? WHERE strategy_id IN (${placeholders}) AND status = 'active'`)
			.bind(champion.strategyId, ...ids)
			.run();
		result.reassignedBots = moved.meta.changes ?? 0;
	}

	// Evolve the champion: mutated clone, next generation, fresh bot with colony
	// DNA. A champion breeds again only once its youngest child has produced
	// enough trade evidence — otherwise repeat learns would spawn duplicates.
	const unprovenChild = champion
		? await db
				.prepare(
					`SELECT s.id FROM strategies s
					 LEFT JOIN trades t ON t.strategy_id = s.id AND t.outcome != 'open'
					 WHERE s.parent_id = ? AND s.status = 'active'
					 GROUP BY s.id HAVING COUNT(t.id) < ?`,
				)
				.bind(champion.strategyId, MIN_TRADES)
				.first()
		: null;
	if (champion && !unprovenChild) {
		const row = rows.find((r) => r.strategyId === champion.strategyId)!;
		const siblings = await db
			.prepare("SELECT COUNT(*) as n FROM strategies WHERE parent_id = ?")
			.bind(champion.strategyId)
			.first<{ n: number }>();
		const siblingCount = siblings?.n ?? 0;
		// Insight controls the brood: higher levels breed more variants per pass,
		// exploring more boldly around the champion.
		const broodSize = 1 + Math.min(2, Math.floor((insight - 1) / 2));
		const mutationScale = 1 + 0.15 * (insight - 1);
		const soul = await colonyDna(db);

		for (let b = 0; b < broodSize; b++) {
			const seq = siblingCount + b;
			const rand = mulberry32(champion.strategyId * 7919 + champion.generation * 131 + seq);
			const childParams = mutateParams(champion.kind, safeJson(row.params) as StrategyParams, rand, mutationScale);
			// Later siblings get a letter suffix so every lineage name stays unique.
			const childName =
				champion.name.replace(/ g\d+[a-z]?$/, "") +
				` g${champion.generation + 1}` +
				(seq > 0 ? String.fromCharCode(97 + seq) : "");
			const child = await db
				.prepare(
					"INSERT INTO strategies (name, kind, params, generation, parent_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
				)
				.bind(
					childName,
					champion.kind,
					JSON.stringify(childParams),
					champion.generation + 1,
					champion.strategyId,
				)
				.first<{ id: number }>();
			const bot = await db
				.prepare(
					"INSERT INTO bots (name, soul, strategy_id, symbol, balance, starting_balance) VALUES (?, ?, ?, 'SIM-BTC', ?, ?) RETURNING id",
				)
				.bind(childName.replace(/ /g, "-"), JSON.stringify(soul), child!.id, CHILD_STAKE, CHILD_STAKE)
				.first<{ id: number }>();
			result.brood++;
			if (!result.evolved) {
				result.evolved = { fromStrategyId: champion.strategyId, newStrategyId: child!.id, newBotId: bot!.id };
			}
		}
	}

	// Keep the roadmap honest: win-rate goal tracks the measured number.
	await db
		.prepare("UPDATE goals SET progress = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE title = 'Raise the win rate'")
		.bind(result.overallWinRate)
		.run();

	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('observer', 'learning', ?, ?, ?, 'invest')")
		.bind(
			`Learning pass: ${judged.length} strategies judged`,
			`Colony win rate ${(result.overallWinRate * 100).toFixed(1)}%. Retired ${result.retired.length} strategies, reassigned ${result.reassignedBots} bots` +
				(champion
					? result.brood > 0
						? `, evolved champion "${champion.name}" (score ${champion.score.toFixed(2)}) into generation ${champion.generation + 1} — brood of ${result.brood} at insight L${insight}.`
						: `. Champion "${champion.name}" holds; its youngest child is still proving itself.`
					: ". No champion yet — need more trade evidence."),
			JSON.stringify(result),
		)
		.run();

	return result;
}

// Bots inherit their soul from the colony's core agents — Lumi's curiosity,
// Reg's discipline, the Databank's caution — averaged into one DNA.
export async function colonyDna(db: D1Database): Promise<Record<string, number>> {
	const agents = (await db.prepare("SELECT dna FROM agents WHERE status = 'active'").all<{ dna: string }>()).results;
	const merged: Record<string, { sum: number; n: number }> = {};
	for (const a of agents) {
		const dna = safeJson(a.dna);
		for (const [k, v] of Object.entries(dna)) {
			if (typeof v !== "number") continue;
			merged[k] = { sum: (merged[k]?.sum ?? 0) + v, n: (merged[k]?.n ?? 0) + 1 };
		}
	}
	return Object.fromEntries(Object.entries(merged).map(([k, { sum, n }]) => [k, Number((sum / n).toFixed(3))]));
}

function totalWinRate(scores: StrategyScore[]): number {
	const closed = scores.reduce((n, s) => n + s.closed, 0);
	const wins = scores.reduce((n, s) => n + s.wins, 0);
	return closed > 0 ? wins / closed : 0;
}

function safeJson(raw: string): Record<string, unknown> {
	try {
		return JSON.parse(raw) ?? {};
	} catch {
		return {};
	}
}
