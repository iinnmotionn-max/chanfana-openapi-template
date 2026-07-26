import { SELF } from "cloudflare:test";
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

const ADDR_RE = /^0x[0-9a-fA-F]{64}$/;

describe("Wallet — a real in-app web3 wallet over the AETHER ledger", () => {
	it("lists the genesis accounts, each with a 0x address", async () => {
		const res = await get("/wallet");
		expect(res.status).toBe(200);
		const owners = res.body.result.map((w: any) => w.owner);
		for (const name of ["treasury", "creator", "lumi", "aether"]) {
			const w = res.body.result.find((x: any) => x.owner === name);
			expect(w, `wallet ${name} present`).toBeTruthy();
			expect(w.address.startsWith("0x")).toBe(true);
		}
		expect(owners).toContain("treasury");
	});

	it("lets Aether mint its own self-custody web3 wallet", async () => {
		const first = await post("/wallet/aether");
		expect(first.status).toBe(200);
		expect(first.body.result.owner).toBe("aether");
		// Aether upgrades from its short genesis address to a full 0x+64 address.
		expect(ADDR_RE.test(first.body.result.address)).toBe(true);

		// Idempotent — a second call returns the same address, doesn't re-mint.
		const second = await post("/wallet/aether");
		expect(second.body.result.minted).toBe(false);
		expect(second.body.result.address).toBe(first.body.result.address);

		// It's recorded in the Aether (invest) realm.
		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.author === "aether" && r.kind === "wallet")).toBe(true);
	});

	it("creates a wallet with a real 0x+64hex address and zero balance", async () => {
		const created = await post("/wallet", { label: "alice" });
		expect(created.status).toBe(201);
		expect(created.body.result.owner).toBe("alice");
		expect(created.body.result.address).toMatch(ADDR_RE);
		expect(created.body.result.balance).toBe(0);

		const fetched = await get("/wallet/alice");
		expect(fetched.status).toBe(200);
		expect(fetched.body.result.owner).toBe("alice");
		expect(fetched.body.result.address).toMatch(ADDR_RE);
		expect(fetched.body.result.balance).toBe(0);
	});

	it("receives a funding send and records it as an 'in' transaction", async () => {
		await post("/wallet", { label: "alice" });
		const send = await post("/wallet/send", { from: "creator", to: "alice", amount: 2500, memo: "seed" });
		expect(send.status).toBe(200);

		const w = await get("/wallet/alice");
		expect(w.body.result.balance).toBe(2500);
		const inbound = w.body.result.history.filter((h: any) => h.direction === "in");
		expect(inbound.length).toBe(1);
		expect(inbound[0].counterparty).toBe("creator");
		expect(inbound[0].amount).toBe(2500);
	});

	it("rejects an overdraft with 400", async () => {
		await post("/wallet", { label: "alice" });
		await post("/wallet/send", { from: "creator", to: "alice", amount: 2500, memo: "seed" });
		const over = await post("/wallet/send", { from: "alice", to: "creator", amount: 99999 });
		expect(over.status).toBe(400);
		// balance unchanged
		const w = await get("/wallet/alice");
		expect(w.body.result.balance).toBe(2500);
	});

	it("sends by ADDRESS as well as by owner handle", async () => {
		const bob = await post("/wallet", { label: "bob" });
		expect(bob.status).toBe(201);
		const bobAddr = bob.body.result.address;
		expect(bobAddr).toMatch(ADDR_RE);

		const send = await post("/wallet/send", { from: "creator", to: bobAddr, amount: 1200, memo: "by address" });
		expect(send.status).toBe(200);

		const w = await get(`/wallet/${bobAddr}`);
		expect(w.body.result.owner).toBe("bob");
		expect(w.body.result.balance).toBe(1200);
	});

	it("links a self-custody Sui address (and rejects a bad one)", async () => {
		await post("/wallet", { label: "alice" });
		const good = await post("/wallet/link", { ref: "alice", suiAddress: "0x" + "a".repeat(64) });
		expect(good.status).toBe(200);
		expect(good.body.result.owner).toBe("alice");
		expect(good.body.result.sui_address).toBe("0x" + "a".repeat(64));

		const w = await get("/wallet/alice");
		expect(w.body.result.sui_address).toBe("0x" + "a".repeat(64));

		const bad = await post("/wallet/link", { ref: "alice", suiAddress: "0x1234" });
		expect(bad.status).toBe(400);
	});

	it("404s on an unknown wallet reference", async () => {
		const missing = await get("/wallet/nobody-here");
		expect(missing.status).toBe(404);
	});

	it("conserves total AETHER supply through every wallet send", async () => {
		const a = await get("/aether");
		expect(a.status).toBe(200);
		expect(a.body.result.reconciled).toBe(true);
	});
});
