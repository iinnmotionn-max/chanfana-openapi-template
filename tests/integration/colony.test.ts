import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}

async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

describe("Lumi Colony — full loop", () => {
	it("seeds the colony with agents, strategies, and bots", async () => {
		const seed = await post("/colony/seed");
		expect(seed.status).toBe(200);
		expect(seed.body.success).toBe(true);
		expect(seed.body.result.strategies).toBe(3);
		expect(seed.body.result.bots).toBe(3);

		const agents = await get("/agents");
		expect(agents.body.result.map((a: any) => a.name)).toEqual(
			expect.arrayContaining(["lumi", "reg", "databank", "observer", "reporter"]),
		);

		const bots = await get("/bots");
		expect(bots.body.result.length).toBe(3);
		// Every bot carries a soul merged from the colony's DNA.
		for (const bot of bots.body.result) {
			expect(bot.soul).toHaveProperty("risk");
			expect(bot.soul).toHaveProperty("patience");
		}
	});

	it("is idempotent — a second seed does not duplicate the colony", async () => {
		await post("/colony/seed");
		const again = await post("/colony/seed");
		expect(again.body.result.created).toBe(false);
		const bots = await get("/bots");
		expect(bots.body.result.length).toBe(3);
	});

	it("runs a trading cycle: trades recorded, balances compound, Reporter files", async () => {
		await post("/colony/seed");
		const run = await post("/engine/run", { ticks: 400 });
		expect(run.status).toBe(200);
		expect(run.body.result.toTick).toBe(400);
		expect(run.body.result.closed).toBeGreaterThan(0);

		const trades = await get("/trades?limit=500");
		expect(trades.body.result.length).toBeGreaterThan(0);
		const closed = trades.body.result.filter((t: any) => t.outcome !== "open");
		expect(closed.length).toBe(run.body.result.closed);
		// Closed trades carry the full lesson: entry, exit, pnl, outcome, reason.
		for (const t of closed) {
			expect(t.exit_price).not.toBeNull();
			expect(["win", "loss", "flat"]).toContain(t.outcome);
			expect(t.reason.length).toBeGreaterThan(0);
		}

		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "cycle" && r.author === "reporter")).toBe(true);
	});

	it("continues the same tape across cycles instead of restarting", async () => {
		await post("/colony/seed");
		const first = await post("/engine/run", { ticks: 100 });
		const second = await post("/engine/run", { ticks: 100 });
		expect(second.body.result.fromTick).toBe(first.body.result.toTick);
		expect(second.body.result.toTick).toBe(200);
	});

	it("learns: scores strategies on evidence, evolves the champion, Observer reports", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 600 });

		const learn = await post("/engine/learn");
		expect(learn.status).toBe(200);
		const result = learn.body.result;
		expect(result.scores.length).toBeGreaterThanOrEqual(3);
		for (const s of result.scores) {
			expect(s.score).toBeGreaterThanOrEqual(0);
			expect(s.score).toBeLessThanOrEqual(1);
		}

		// With enough evidence a champion evolves: new generation, lineage kept.
		expect(result.evolved).not.toBeNull();
		const strategies = await get("/strategies");
		const child = strategies.body.result.find((s: any) => s.id === result.evolved.newStrategyId);
		expect(child.generation).toBe(2);
		expect(child.parent_id).toBe(result.evolved.fromStrategyId);

		// Retired strategies lose their bots to the champion.
		for (const id of result.retired) {
			const retired = strategies.body.result.find((s: any) => s.id === id);
			expect(retired.status).toBe("retired");
		}
		const bots = await get("/bots");
		const activeStrategyIds = strategies.body.result.filter((s: any) => s.status === "active").map((s: any) => s.id);
		for (const bot of bots.body.result.filter((b: any) => b.status === "active")) {
			expect(activeStrategyIds).toContain(bot.strategy_id);
		}

		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "learning" && r.author === "observer")).toBe(true);

		// The win-rate goal tracks the measured number.
		const goals = await get("/goals");
		const winGoal = goals.body.result.find((g: any) => g.title === "Raise the win rate");
		expect(winGoal.status).toBe("in_progress");
	});

	it("does not breed again while the champion's child is still unproven", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 600 });

		const first = await post("/engine/learn");
		expect(first.body.result.evolved).not.toBeNull();

		// The child has no trade evidence yet — a second learn must not clone it.
		const second = await post("/engine/learn");
		expect(second.body.result.evolved).toBeNull();

		const strategies = await get("/strategies");
		const names = strategies.body.result.map((s: any) => s.name);
		expect(new Set(names).size).toBe(names.length);
	});

	it("creates a bot that inherits colony DNA and rejects unknown strategies", async () => {
		await post("/colony/seed");
		const strategies = await get("/strategies");
		const strategyId = strategies.body.result[0].id;

		const created = await post("/bots", { name: "scout-1", strategy_id: strategyId, balance: 500 });
		expect(created.status).toBe(201);
		expect(created.body.result.soul).toHaveProperty("risk");
		expect(created.body.result.balance).toBe(500);

		const bad = await post("/bots", { name: "ghost", strategy_id: 99999 });
		expect(bad.status).toBe(400);
	});

	it("manages goals: create and update progress", async () => {
		const created = await post("/goals", { title: "Test goal", detail: "check the flow", priority: 2 });
		expect(created.status).toBe(201);
		const id = created.body.result.id;

		const res = await SELF.fetch(`http://local.test/goals/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "done", progress: 1 }),
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.result.status).toBe("done");
		expect(body.result.progress).toBe(1);

		const missing = await SELF.fetch(`http://local.test/goals/99999`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "done" }),
		});
		expect(missing.status).toBe(404);
	});

	it("serves the analytics overview with everything Lumi needs", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 300 });

		const overview = await get("/analytics/overview");
		expect(overview.status).toBe(200);
		const r = overview.body.result;
		expect(r.colony.tick).toBe(300);
		expect(r.colony.closedTrades).toBeGreaterThan(0);
		expect(r.colony.equity).toBeGreaterThan(0);
		expect(r.agents.length).toBe(6);
		expect(r.bots.length).toBe(3);
		expect(r.strategies.length).toBe(3);
		expect(r.equityCurve.length).toBeGreaterThan(1);
		expect(r.equityCurve[0]).toEqual({ tick: 0, equity: r.colony.startingEquity });
		expect(r.reports.length).toBeGreaterThan(0);
		expect(r.goals.length).toBeGreaterThanOrEqual(5);
	});

	it("serves Lumi, the dashboard", async () => {
		const res = await SELF.fetch("http://local.test/dash");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const html = await res.text();
		expect(html).toContain("Lumi");
		expect(html).toContain("/analytics/overview");
	});
});
