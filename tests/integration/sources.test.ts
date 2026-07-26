import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Every panel renders real rows out of the Databank — none of it is mock. But
// "real rows" and "real world" are different claims, and an unlabelled number
// lets a reader take only the flattering one. These tests hold the labels to
// the state that actually exists.

async function sources() {
	const d = ((await (await SELF.fetch("http://local.test/analytics/overview")).json()) as any).result;
	return Object.fromEntries(d.sources.map((s: any) => [s.panel, s]));
}

describe("Panel provenance — a simulation must never look like the real thing", () => {
	it("labels the market SIM while it is running the simulated tape", async () => {
		const s = await sources();
		expect(s.market.kind).toBe("sim");
		expect(s.market.label).toBe("SIM TAPE");
	});

	it("never calls the trading panels live money, on either feed", async () => {
		const s = await sources();
		expect(s.trading.detail).toContain("paper trading");
		expect(s.trading.detail).toContain("No broker is connected");
	});

	it("flips the market to LIVE only when real observations actually exist", async () => {
		// market_state is created lazily by the first cycle, not by seeding.
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		await SELF.fetch("http://local.test/engine/run", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticks: 20 }),
		});
		// A symbol switched to live with no data replays a flat line — the feed
		// refuses to invent movement, so this must NOT read as a live market.
		await env.DB.prepare("UPDATE market_state SET feed = 'live'").run();
		expect((await sources()).market.kind, "live mode but no data is not live").toBe("sim");

		// Two real observations is the threshold the feed itself uses.
		const sym = await env.DB.prepare("SELECT symbol FROM market_state LIMIT 1").first<{ symbol: string }>();
		await env.DB.prepare("INSERT INTO live_ticks (symbol, price, source) VALUES (?, 100, 'test')").bind(sym!.symbol).run();
		expect((await sources()).market.kind, "one observation is still not a market").toBe("sim");

		await env.DB.prepare("INSERT INTO live_ticks (symbol, price, source) VALUES (?, 101, 'test')").bind(sym!.symbol).run();
		const live = await sources();
		expect(live.market.kind).toBe("live");
		expect(live.market.detail).toContain("banked real observations");
		// Even on live prices, the trading panel keeps saying it is paper.
		expect(live.trading.label).toContain("PAPER");
	});

	it("marks the conserved ledger as real, because it is", async () => {
		const s = await sources();
		for (const p of ["aether", "wallet", "defi"]) {
			expect(s[p].kind, p).toBe("ledger");
		}
		expect(s.aether.detail).toContain("not a traded asset outside it");
	});

	it("says OFFLINE with the missing key, not a vague dash", async () => {
		const s = await sources();
		// No model keys are bound in tests.
		expect(s.orchestrator.kind).toBe("offline");
		expect(s.orchestrator.detail).toContain("ANTHROPIC_API_KEY");
		expect(s.growth.kind).toBe("offline");
		expect(s.growth.detail).toContain("Nothing leaves the system");
	});

	it("distinguishes ARMED from LIVE — a set secret is not a working bridge", async () => {
		// Both bridge secrets ARE bound in tests, but nothing has called yet.
		const s = await sources();
		expect(s.rp.label).toBe("ARMED");
		expect(s.rp.detail).toContain("no game server has called yet");

		// One real call, and only then does it read live.
		await SELF.fetch("http://local.test/rp/grant", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: 991, amount: 1, secret: "test-rp-secret", place: "p1" }),
		});
		expect((await sources()).rp.label).toBe("LIVE BRIDGE");
	});

	it("the pulse reaches for real prices every time, and says so when it cannot", async () => {
		const r = ((await (await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" })).json()) as any).result;
		const line = r.decisions.find((d: string) => d.includes("live prices") || d.includes("real market observation"));
		expect(line, "every pulse reports its attempt at real data").toBeTruthy();
		// No outbound network in tests, so it must report the miss honestly
		// rather than quietly leaving the tape simulated.
		expect(line).toContain("the tape stays simulated");
	});
});
