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

// Matches the binding in tests/vitest.config.mts. In production the bridge is
// OFF until the operator sets RP_SHARED_SECRET (503 path, guarded in code).
const SECRET = "test-rp-secret";

describe("InMotion RP — Roblox bridge into the AETHER economy", () => {
	it("rejects a bad shared secret with 401 (and an empty one)", async () => {
		const wrong = await post("/rp/grant", { userId: 1, amount: 10, secret: "wrong" });
		expect(wrong.status).toBe(401);
		const empty = await post("/rp/grant", { userId: 1, amount: 10 });
		expect(empty.status).toBe(401);
	});

	it("credits a player from the treasury and conserves total supply", async () => {
		const grant = await post("/rp/grant", { userId: 261, name: "Mayor", amount: 250, reason: "paycheck", secret: SECRET });
		expect(grant.status).toBe(200);
		expect(grant.body.result.owner).toBe("rp-261");
		expect(grant.body.result.granted).toBe(250);
		expect(grant.body.result.balance).toBe(250);

		// The player's wallet is a real ledger account with history.
		const player = await get("/rp/player/261");
		expect(player.status).toBe(200);
		expect(player.body.result.balance).toBe(250);
		expect(player.body.result.history[0].direction).toBe("in");
		expect(player.body.result.history[0].counterparty).toBe("treasury");

		// Supply invariant: the grant moved credits, it did not mint them.
		const aether = await get("/aether");
		expect(aether.body.result.reconciled).toBe(true);
	});

	it("grants are cumulative with one account per player", async () => {
		await post("/rp/grant", { userId: 500, amount: 100, reason: "job", secret: SECRET });
		const second = await post("/rp/grant", { userId: 500, amount: 50, reason: "event", secret: SECRET });
		expect(second.body.result.balance).toBe(150);

		const wallets = await get("/wallet");
		const mine = wallets.body.result.filter((w: any) => w.owner === "rp-500");
		expect(mine.length).toBe(1);
		expect(mine[0].kind).toBe("rp");
	});

	it("404s for a player who has never been granted", async () => {
		const res = await get("/rp/player/999999");
		expect(res.status).toBe(404);
	});
});
