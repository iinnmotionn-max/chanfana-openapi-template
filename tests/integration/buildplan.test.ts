import { SELF, env } from "cloudflare:test";
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

describe("Build plan — live feed, risk gates, win-rate filter", () => {
	// ---- Risk gates for capital ----
	it("exposes risk status and lets the creator halt and resume", async () => {
		const status = await get("/risk");
		expect(status.status).toBe(200);
		expect(status.body.result.halted).toBe(false);
		expect(status.body.result.maxDrawdown).toBeGreaterThan(0);

		const halt = await post("/risk/halt", { reason: "test halt" });
		expect(halt.body.result.halted).toBe(true);

		const resume = await post("/risk/resume", { reason: "test resume" });
		expect(resume.body.result.halted).toBe(false);
	});

	it("a halted colony manages open positions but opens no new ones", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 300 }); // build some open positions + history
		await post("/risk/halt", { reason: "freeze" });

		const before = await get("/trades?limit=500");
		const openedBefore = before.body.result.filter((t: any) => t.outcome === "open").length;

		const run = await post("/engine/run", { ticks: 300 });
		expect(run.body.result.halted).toBe(true);
		// No NEW positions opened while halted (opened counter stays 0)...
		expect(run.body.result.opened).toBe(0);

		const after = await get("/trades?limit=500");
		const openAfter = after.body.result.filter((t: any) => t.outcome === "open").length;
		// ...and open exposure did not grow.
		expect(openAfter).toBeLessThanOrEqual(openedBefore);
	});

	it("PATCH /risk/config tunes the limits", async () => {
		const res = await SELF.fetch("http://local.test/risk/config", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ maxDrawdown: 0.5, maxOpenPositions: 20 }),
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.result.maxDrawdown).toBe(0.5);
		expect(body.result.maxOpenPositions).toBe(20);
	});

	it("the guardian sweep reports the risk-gates check", async () => {
		const sweep = await post("/realms/guardian/sweep");
		const names = sweep.body.result.checks.map((c: any) => c.name);
		expect(names).toContain("risk-gates");
	});

	// ---- Live data adapter ----
	it("sim feed is the default and trades deterministically", async () => {
		await post("/colony/seed");
		const run = await post("/engine/run", { ticks: 300 });
		expect(run.body.result.live).toBe(false);
		expect(run.body.result.closed).toBeGreaterThan(0);

		const markets = await get("/market");
		expect(markets.body.result.every((m: any) => m.feed === "sim")).toBe(true);
	});

	it("a symbol switched to live replays banked observations instead of the sim tape", async () => {
		await post("/colony/seed");
		const strategies = await get("/strategies");
		const strategyId = strategies.body.result[0].id;
		// A bot on a live symbol; its market row is created by the first cycle.
		await post("/bots", { name: "live-scout", strategy_id: strategyId, symbol: "LIVE-BTC", balance: 1000 });
		await post("/engine/run", { ticks: 50 }); // creates the LIVE-BTC market_state row

		// Bank a rising real-price series so the live feed has a shape to trade.
		for (let i = 0; i < 40; i++) {
			await env.DB.prepare("INSERT INTO live_ticks (symbol, price, source) VALUES ('LIVE-BTC', ?, 'test')")
				.bind(100 + i * 2)
				.run();
		}
		const feed = await post("/market/feed", { symbol: "LIVE-BTC", mode: "live" });
		expect(feed.body.result.feed).toBe("live");

		const run = await post("/engine/run", { ticks: 200 });
		expect(run.body.result.live).toBe(true); // the cycle used the live feed

		const markets = await get("/market");
		const live = markets.body.result.find((m: any) => m.symbol === "LIVE-BTC");
		expect(live.feed).toBe("live");
		expect(live.liveObservations).toBeGreaterThanOrEqual(40);
	});

	it("switching an unknown symbol to live is rejected", async () => {
		const feed = await post("/market/feed", { symbol: "NOPE-XYZ", mode: "live" });
		expect(feed.status).toBe(404);
	});

	// ---- Analytics surfaces the new state ----
	it("analytics overview includes risk and markets", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 200 });
		const overview = await get("/analytics/overview");
		expect(overview.body.result.risk).toBeTruthy();
		expect(typeof overview.body.result.risk.halted).toBe("boolean");
		expect(Array.isArray(overview.body.result.markets)).toBe(true);
		expect(overview.body.result.markets.length).toBeGreaterThan(0);
	});
});
