import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// The colony's central claim is that it LEARNS: scores strategies on evidence,
// retires losers, evolves winners. Nothing had ever checked it.
//
// Checking it turned up two real defects, and one honest non-result.
//
// Defect 1 — the retirement rule could not see money. The score blended win
// rate with profit factor divided by its cap, so a break-even strategy still
// banked a third of the payoff half, and a good hit rate carried a LOSING
// strategy over the floor. "mean reversion" held the best win rate in the
// colony (58%) and the worst expectancy (-0.25/trade) and survived every
// single learning pass. The creator's own words for this project were "we are
// bleeding"; this was one of the wounds.
//
// Defect 2 — every bred child was staked at a founder's full 1000, so unproven
// mutations immediately carried the weight of strategies with hundreds of
// trades behind them, and exploration diluted the returns it existed to find.
//
// Non-result — whether learning beats not-learning on this tape is NOT settled
// here. Measured over 6 rounds learning won (11.4% vs 7.9%); over 12 rounds it
// lost (12.5% vs 16.9%). A deterministic price series is one sample, and a
// comparison that flips sign with the horizon is not evidence. What follows
// therefore asserts the invariants that ARE knowable, and claims nothing about
// returns.

async function post(path: string, body: unknown = {}) {
	const r = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return (await r.json()) as any;
}

async function activeLosers() {
	return (
		await env.DB.prepare(`
			SELECT s.name, s.status, COUNT(t.id) AS closed, COALESCE(AVG(t.pnl), 0) AS expectancy
			FROM strategies s JOIN trades t ON t.strategy_id = s.id AND t.outcome != 'open'
			WHERE s.status = 'active'
			GROUP BY s.id
			HAVING closed >= 8 AND expectancy < 0
		`).all<{ name: string; closed: number; expectancy: number }>()
	).results;
}

describe("Learning — does the colony actually cut its losers?", () => {
	it("retires a strategy that loses money, however often it is right", async () => {
		await post("/colony/seed");
		for (let i = 0; i < 8; i++) await post("/engine/run", { ticks: 400, learn: true });

		const champion = await env.DB.prepare(
			"SELECT id FROM strategies WHERE status = 'active' ORDER BY id LIMIT 1",
		).first<{ id: number }>();
		expect(champion, "something must still be trading").toBeTruthy();

		const losers = await activeLosers();
		expect(
			losers.map((l) => `${l.name} (${l.expectancy.toFixed(3)}/trade over ${l.closed})`),
			"strategies with negative expectancy are still active after learning",
		).toEqual([]);
	});

	it("scores expectancy explicitly, so 'loses money' is visible not inferred", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 600 });
		const r = await post("/engine/learn");
		const scored = r.result.scores.filter((s: any) => s.closed >= 8);
		expect(scored.length).toBeGreaterThan(0);
		for (const s of scored) {
			expect(typeof s.expectancy, `${s.name} reports expectancy`).toBe("number");
		}
	});

	it("does not reward breaking even — payoff is anchored at break-even, not zero", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 600 });
		const r = await post("/engine/learn");
		for (const s of r.result.scores) {
			// A strategy at or below break-even (PF <= 1) must draw its whole
			// score from win rate alone: at most 0.5. Before the fix it could
			// reach 0.67 and clear the 0.35 floor comfortably.
			if (s.profitFactor <= 1) expect(s.score, `${s.name} PF=${s.profitFactor}`).toBeLessThanOrEqual(0.5 + 1e-9);
		}
	});

	it("funds an unproven child smaller than a proven founder", async () => {
		await post("/colony/seed");
		for (let i = 0; i < 6; i++) await post("/engine/run", { ticks: 400, learn: true });
		const bots = (
			await env.DB.prepare("SELECT name, starting_balance FROM bots ORDER BY id").all<{ name: string; starting_balance: number }>()
		).results;
		const children = bots.filter((b) => /g\d/.test(b.name));
		expect(children.length, "learning bred at least one child").toBeGreaterThan(0);
		for (const c of children) {
			expect(c.starting_balance, `${c.name} is staked as a hypothesis, not a founder`).toBeLessThan(1000);
		}
	});

	it("never empties the colony — the champion survives even a bad run", async () => {
		// If every strategy were losing, retiring all of them would leave
		// nothing to trade. The champion is exempt, and that has to hold.
		await post("/colony/seed");
		await env.DB.prepare("UPDATE trades SET pnl = -5, outcome = 'loss' WHERE outcome != 'open'").run();
		await post("/engine/run", { ticks: 400 });
		await post("/engine/learn");
		const left = await env.DB.prepare("SELECT COUNT(*) as n FROM strategies WHERE status = 'active'").first<{ n: number }>();
		expect(left?.n, "something is always left trading").toBeGreaterThan(0);
	});
});
