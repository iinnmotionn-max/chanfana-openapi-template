import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Moving value and publishing outward now need the creator key — locking the
// command bar while leaving these endpoints open would only have moved the
// hole. These suites test the mechanics, so they speak as the creator;
// creator.test.ts is where the lock itself is proven.
const CREATOR_KEY = "test-creator-key";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

const GENESIS = 1_000_000;

describe("Aether token — the AI-credit ledger", () => {
	it("genesis supply is distributed and reconciles", async () => {
		const a = await get("/aether");
		expect(a.status).toBe(200);
		const r = a.body.result;
		expect(r.symbol).toBe("AETHER");
		expect(r.chain).toBe("sui");
		expect(r.totalSupply).toBe(GENESIS);
		expect(r.reconciled).toBe(true);
		const sum = r.accounts.reduce((n: number, x: any) => n + x.balance, 0);
		expect(Math.round(sum)).toBe(GENESIS);
		expect(r.circulating).toBe(GENESIS - r.treasury);
	});

	it("transfers move credits and conserve total supply", async () => {
		const before = await get("/aether");
		const t = await post("/aether/transfer", { from: "creator", to: "lumi", amount: 5000, memo: "top up" });
		expect(t.status).toBe(200);
		expect(t.body.result.balances.lumi).toBeGreaterThan(0);

		const after = await get("/aether");
		expect(after.body.result.totalSupply).toBe(before.body.result.totalSupply); // conserved
		expect(after.body.result.reconciled).toBe(true);
	});

	it("rejects overdrafts and unknown accounts", async () => {
		const over = await post("/aether/transfer", { from: "lumi", to: "creator", amount: 10_000_000 });
		expect(over.status).toBe(400);
		const unknown = await post("/aether/transfer", { from: "ghost", to: "lumi", amount: 1 });
		expect(unknown.status).toBe(400);
	});

	it("reward (treasury→account) and spend (account→treasury) are credit flows", async () => {
		const r = await post("/aether/reward", { to: "aether", amount: 1000, reason: "test reward" });
		expect(r.status).toBe(200);
		const s = await post("/aether/spend", { from: "aether", amount: 500, reason: "AI work" });
		expect(s.status).toBe(200);
		expect(s.body.result.to).toBe("treasury");
		const overspend = await post("/aether/spend", { from: "aether", amount: 10_000_000 });
		expect(overspend.status).toBe(400);
	});

	it("completed quests pay Aether credits to Lumi", async () => {
		const before = (await get("/aether")).body.result.accounts.find((a: any) => a.owner === "lumi").balance;
		await post("/colony/seed");
		await post("/lumi/pulse"); // completes "Open for business" → rewards credits
		const after = (await get("/aether")).body.result.accounts.find((a: any) => a.owner === "lumi").balance;
		expect(after).toBeGreaterThan(before);
	});

	it("the guardian sweep audits Aether supply integrity", async () => {
		const clean = await post("/realms/guardian/sweep");
		const check = clean.body.result.checks.find((c: any) => c.name === "aether-supply");
		expect(check).toBeTruthy();
		expect(check.status).toBe("pass");

		// Corrupt a balance directly, then the audit must catch the supply drift.
		await env.DB.prepare("UPDATE aether_accounts SET balance = balance + 12345 WHERE owner = 'lumi'").run();
		const audit = await post("/aether/audit");
		expect(audit.body.result.status).toBe("fail");
		const dirty = await post("/realms/guardian/sweep");
		const c2 = dirty.body.result.checks.find((c: any) => c.name === "aether-supply");
		expect(c2.status).toBe("fail");
	});

	it("analytics overview surfaces the token", async () => {
		const overview = await get("/analytics/overview");
		expect(overview.body.result.aether).toBeTruthy();
		expect(overview.body.result.aether.symbol).toBe("AETHER");
		expect(overview.body.result.aether.accounts.length).toBeGreaterThanOrEqual(4);
	});

	it("reports the Sui chain link as not-yet-published (honest, offline-safe)", async () => {
		const chain = await get("/aether/chain");
		expect(chain.status).toBe(200);
		const r = chain.body.result;
		// No AETHER_PACKAGE_ID configured in tests → not linked, ledger is truth.
		expect(r.linked).toBe(false);
		expect(r.packageId).toBeNull();
		expect(r.coinType).toBeNull();
		expect(r.rpcUrl).toContain("sui.io");
		expect(r.note).toContain("Not linked");

		// The overview embeds the same chain status under chainLink.
		const a = await get("/aether");
		expect(a.body.result.chain).toBe("sui");
		expect(a.body.result.chainLink.linked).toBe(false);
	});
});
