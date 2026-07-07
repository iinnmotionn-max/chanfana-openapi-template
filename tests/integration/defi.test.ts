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

// "creator" holds 100000 AETHER at genesis (migration 0010).
describe("DeFi liquidity layer — AETHER AMM, vaults, lending", () => {
	it("adds liquidity, mints LP, and shows reserves + TVL", async () => {
		const add = await post("/defi/pool/add", { owner: "creator", aether: 10000, quote: 10000 });
		expect(add.status).toBe(200);
		expect(add.body.result.lpMinted).toBeGreaterThan(0);

		const overview = await get("/defi");
		expect(overview.status).toBe(200);
		const pool = overview.body.result.pools[0];
		expect(pool.reserve_aether).toBeGreaterThanOrEqual(10000);
		expect(pool.reserve_quote).toBeGreaterThanOrEqual(10000);
		expect(overview.body.result.tvlAether).toBeGreaterThanOrEqual(10000);
		// The pool custodies real AETHER in the ledger.
		expect(overview.body.result.poolBalance).toBeGreaterThanOrEqual(10000);
	});

	it("swaps aether_in and accrues fees so the pool earns an APR", async () => {
		await post("/defi/pool/add", { owner: "creator", aether: 10000, quote: 10000 });
		const sw = await post("/defi/swap", { owner: "creator", direction: "aether_in", amountIn: 1000 });
		expect(sw.status).toBe(200);
		expect(sw.body.result.amountOut).toBeGreaterThan(0);
		expect(sw.body.result.priceAfter).toBeDefined();

		const overview = await get("/defi");
		const pool = overview.body.result.pools[0];
		expect(pool.fees_accrued).toBeGreaterThan(0);
		expect(pool.apr).toBeGreaterThan(0);
	});

	it("vault deposit then withdraw pays yield and keeps supply reconciled", async () => {
		const dep = await post("/defi/vault/deposit", { owner: "creator", amount: 5000 });
		expect(dep.status).toBe(200);

		const wd = await post("/defi/vault/withdraw", { owner: "creator", amount: 5000 });
		expect(wd.status).toBe(200);
		expect(wd.body.result.withdrawn).toBe(5000);
		expect(wd.body.result.yield).toBeGreaterThanOrEqual(0);

		const aether = await get("/aether");
		expect(aether.body.result.reconciled).toBe(true);
	});

	it("borrows within 50% LTV, rejects over-LTV, and repays to unlock collateral", async () => {
		// Establish a pool price so LTV is meaningful.
		await post("/defi/pool/add", { owner: "creator", aether: 10000, quote: 10000 });

		const ok = await post("/defi/borrow", { owner: "creator", collateral: 2000, borrow: 500 });
		expect(ok.status).toBe(200);
		expect(ok.body.result.loanId).toBeGreaterThan(0);

		const over = await post("/defi/borrow", { owner: "creator", collateral: 1000, borrow: 100000 });
		expect(over.status).toBe(400);

		const repaid = await post("/defi/repay", { loanId: ok.body.result.loanId });
		expect(repaid.status).toBe(200);
		expect(repaid.body.result.repaid).toBe(true);
	});

	it("removes liquidity and returns AETHER + quote", async () => {
		const add = await post("/defi/pool/add", { owner: "creator", aether: 10000, quote: 10000 });
		const lp = add.body.result.lpMinted;

		const rm = await post("/defi/pool/remove", { owner: "creator", lp: lp / 2 });
		expect(rm.status).toBe(200);
		expect(rm.body.result.aetherOut).toBeGreaterThan(0);
		expect(rm.body.result.quoteOut).toBeGreaterThan(0);
	});

	it("registers the 'aether' realm and keeps AETHER supply reconciled after activity", async () => {
		const realms = await get("/realms");
		expect(realms.status).toBe(200);
		const aetherRealm = realms.body.result.find((r: any) => r.key === "aether");
		expect(aetherRealm).toBeTruthy();
		expect(aetherRealm.title).toBe("Aether");

		// Exercise the whole layer, then confirm the fixed supply still reconciles.
		await post("/defi/pool/add", { owner: "creator", aether: 8000, quote: 8000 });
		await post("/defi/swap", { owner: "creator", direction: "aether_in", amountIn: 500 });
		await post("/defi/vault/deposit", { owner: "creator", amount: 3000 });
		await post("/defi/vault/withdraw", { owner: "creator", amount: 3000 });
		const loan = await post("/defi/borrow", { owner: "creator", collateral: 1000, borrow: 100 });
		await post("/defi/repay", { loanId: loan.body.result.loanId });

		const aether = await get("/aether");
		expect(aether.body.result.reconciled).toBe(true);
	});
});
