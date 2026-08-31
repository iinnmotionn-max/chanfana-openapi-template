import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Both bridges are mid-rotation in the test environment: a current secret and
// an outgoing one (see tests/vitest.config.mts). These tests hold the whole
// point of the feature — you can change a secret without taking the bridge
// down, and you cannot forget that you did.

const RP_NEW = "test-rp-secret";
const RP_OLD = "old-rp-secret";
const AGENT_NEW = "test-agent-secret";
const AGENT_OLD = "old-agent-secret";

async function post(path: string, body: unknown) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}

async function shieldAuthority() {
	const res = await SELF.fetch("http://local.test/shield");
	const p = ((await res.json()) as any).result.posture;
	return p.dimensions.find((d: any) => d.dimension === "authority");
}

describe("Secret rotation — changing a key without downtime", () => {
	it("accepts the CURRENT secret on both bridges", async () => {
		expect((await post("/rp/grant", { userId: 4101, amount: 5, secret: RP_NEW })).status).toBe(200);
		expect((await post("/local/next", { secret: AGENT_NEW, host: "box" })).status).toBe(200);
	});

	it("still accepts the OUTGOING secret — the bridge never goes down mid-rotation", async () => {
		// This is the whole feature: a Roblox server or an agent that hasn't been
		// updated yet keeps working while you migrate it.
		const grant = await post("/rp/grant", { userId: 4102, amount: 5, secret: RP_OLD, place: "rp-server-7" });
		expect(grant.status).toBe(200);
		expect(grant.body.result.granted).toBeGreaterThan(0);

		const claim = await post("/local/next", { secret: AGENT_OLD, host: "old-laptop" });
		expect(claim.status).toBe(200);
	});

	it("a secret that is neither current nor previous is still refused", async () => {
		expect((await post("/rp/grant", { userId: 4103, amount: 5, secret: "not-either-one" })).status).toBe(401);
		expect((await post("/local/next", { secret: "not-either-one" })).status).toBe(401);
	});

	it("records every call made on the OUTGOING secret, naming the caller", async () => {
		await post("/rp/grant", { userId: 4104, amount: 1, secret: RP_OLD, place: "rp-server-7" });
		await post("/local/next", { secret: AGENT_OLD, host: "old-laptop" });

		const auth = await shieldAuthority();
		const rp = auth.findings.find((f: any) => f.title.includes("roblox city"));
		const local = auth.findings.find((f: any) => f.title.includes("local agent"));
		expect(rp, "the RP rotation window is surfaced").toBeTruthy();
		expect(local, "the agent rotation window is surfaced").toBeTruthy();
		// Callers are still on the old key — Shield must say "don't remove it yet".
		expect(rp.detail).toContain("OLD secret");
		expect(rp.detail).toContain("RP_SHARED_SECRET_PREVIOUS");
		expect(local.detail).toContain("LOCAL_AGENT_SECRET_PREVIOUS");
	});

	it("with nobody on the old key, Shield says the window is safe to close", async () => {
		// No legacy calls in this isolated test — only current secrets used.
		await post("/rp/grant", { userId: 4105, amount: 1, secret: RP_NEW });
		const auth = await shieldAuthority();
		const rp = auth.findings.find((f: any) => f.title.includes("roblox city"));
		expect(rp.detail).toContain("safe to remove");
		// An unclosed window with no users is the forgettable case — warn on it.
		expect(rp.severity).toBe("warn");
	});

	it("an open rotation window costs posture — it is two valid secrets, not one", async () => {
		const auth = await shieldAuthority();
		expect(auth.score).toBeLessThan(1);
	});
});
