import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Every integration in this system reports itself honestly offline when it
// isn't configured. Spread across a dozen panels, that answers "is this on?"
// one component at a time and never answers "what do I still have to do?".
// This is that page — and its only real failure mode is overstating.

async function ready() {
	return ((await (await SELF.fetch("http://local.test/ready")).json()) as any).result;
}

describe("Readiness — what is wired, and what to type for what isn't", () => {
	it("reports each switch with what it unlocks and the exact command", async () => {
		const r = await ready();
		expect(r.items.length).toBeGreaterThan(5);
		for (const i of r.items) {
			expect(i.envKey, "every item names its env var").toBeTruthy();
			expect(i.unlocks.length, `${i.envKey} must say what it unlocks`).toBeGreaterThan(20);
			expect(i.command, `${i.envKey} must say how to set it`).toMatch(/wrangler secret put|bash /);
		}
	});

	it("reflects real environment state, not a hardcoded list", async () => {
		// These ARE bound in tests; unbound ones must read as missing. A page
		// that always says the same thing is worse than no page.
		const r = await ready();
		const byKey = Object.fromEntries(r.items.map((i: any) => [i.envKey, i.configured]));
		expect(byKey.CREATOR_KEY).toBe(true);
		expect(byKey.RP_SHARED_SECRET).toBe(true);
		expect(byKey.LOCAL_AGENT_SECRET).toBe(true);
		expect(byKey.ANTHROPIC_API_KEY, "not bound in tests").toBe(false);
		expect(byKey.X_TOKEN, "not bound in tests").toBe(false);
	});

	it("names ONE next step rather than a wall of everything", async () => {
		const r = await ready();
		expect(r.nextStep).toBeTruthy();
		// Required is satisfied here, so it should point at the recommended gap.
		expect(r.deployable).toBe(true);
		expect(r.nextStep).toContain("ANTHROPIC_API_KEY");
	});

	it("treats the creator key as REQUIRED and says why in the item itself", async () => {
		const key = (await ready()).items.find((i: any) => i.envKey === "CREATOR_KEY");
		expect(key.need).toBe("required");
		expect(key.note).toContain("including you");
	});

	it("refuses to claim a configured key WORKS", async () => {
		// The one honest failure mode here is overstating. A revoked API key
		// looks identical to a good one from this side, and the page must say so.
		const r = await ready();
		expect(r.caveat).toContain("not that it works");
		expect(r.caveat).toContain("revoked");
	});

	it("rides along in the cockpit payload", async () => {
		const d = ((await (await SELF.fetch("http://local.test/analytics/overview")).json()) as any).result;
		expect(d.readiness.items.length).toBeGreaterThan(5);
		expect(d.readiness.configured).toBeGreaterThan(0);
	});

	it("is readable without a key — you can always see what is missing", async () => {
		const res = await SELF.fetch("http://local.test/ready");
		expect(res.status).toBe(200);
	});
});
