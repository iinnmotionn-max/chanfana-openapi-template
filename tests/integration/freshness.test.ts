import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, cacheControl: res.headers.get("cache-control"), body: (await res.json()) as any };
}

async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, cacheControl: res.headers.get("cache-control"), body: (await res.json()) as any };
}

describe("Freshness — the cockpit never serves stale data", () => {
	it("serves the analytics overview with a no-store Cache-Control header", async () => {
		const overview = await get("/analytics/overview");
		expect(overview.status).toBe(200);
		expect(overview.cacheControl).toContain("no-store");
	});

	it("serves the dashboard as no-store HTML", async () => {
		const res = await SELF.fetch("http://local.test/dash");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(res.headers.get("cache-control")).toContain("no-store");
	});

	it("reads reflect writes: analytics never lags behind engine runs", async () => {
		await post("/colony/seed");

		const firstRun = await post("/engine/run", { ticks: 300 });
		expect(firstRun.status).toBe(200);

		const afterFirst = await get("/analytics/overview");
		expect(afterFirst.status).toBe(200);
		expect(afterFirst.body.result.colony.tick).toBe(300);
		expect(afterFirst.body.result.colony.closedTrades).toBeGreaterThan(0);

		const secondRun = await post("/engine/run", { ticks: 200 });
		expect(secondRun.status).toBe(200);

		const afterSecond = await get("/analytics/overview");
		expect(afterSecond.status).toBe(200);
		// The read must show the cumulative state (300 + 200), never a stale 300.
		expect(afterSecond.body.result.colony.tick).toBe(500);
	});

	it("marks mutating engine responses as no-store", async () => {
		await post("/colony/seed");
		const run = await post("/engine/run", { ticks: 100 });
		expect(run.status).toBe(200);
		expect(run.cacheControl).toContain("no-store");
	});
});
