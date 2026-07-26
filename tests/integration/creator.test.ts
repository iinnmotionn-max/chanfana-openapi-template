import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// The authority ledger was built as the boundary on Lumi's power — but the
// endpoint that WRITES the ledger was open to anyone who knew the URL. An
// attacker's first move was simply to grant themselves the scope they wanted.
// These tests are the proof that move no longer works.

const KEY = "test-creator-key";
const auth0 = (p: any) => p.dimensions.find((d: any) => d.dimension === "authority");

async function send(method: string, path: string, body: unknown, key?: string) {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (key) headers["X-Creator-Key"] = key;
	const res = await SELF.fetch(`http://local.test${path}`, { method, headers, body: JSON.stringify(body) });
	return { status: res.status, body: (await res.json()) as any };
}
const patch = (b: unknown, key?: string) => send("PATCH", "/command/authority", b, key);
const order = (o: string, key?: string) => send("POST", "/command", { order: o }, key);

describe("The control plane has a lock — the ledger is not self-serve", () => {
	it("REFUSES to grant a consequential scope without the creator key", async () => {
		for (const scope of ["machine", "spend", "publish", "command"]) {
			const res = await patch({ scope, granted: true });
			expect(res.status, `${scope} must not be grantable`).toBe(403);
			expect(res.body.errors[0].message).toContain("creator key");
		}
		// And the ledger is genuinely unchanged, not merely reported as refused.
		const state = ((await (await SELF.fetch("http://local.test/command")).json()) as any).result.authority;
		for (const a of state) {
			if (["machine", "spend", "publish", "command"].includes(a.scope)) expect(a.granted, `${a.scope} still revoked`).toBe(false);
		}
	});

	it("grants the same scope when the key is presented", async () => {
		const res = await patch({ scope: "spend", granted: true }, KEY);
		expect(res.status).toBe(200);
		expect(res.body.result.granted).toBe(true);
	});

	it("REVOKING never needs a key — you must always be able to shut a door", async () => {
		await patch({ scope: "machine", granted: true }, KEY);
		const off = await patch({ scope: "machine", granted: false }); // no key
		expect(off.status).toBe(200);
		expect(off.body.result.granted).toBe(false);
	});

	it("refuses an order under a guarded scope even when the scope IS granted", async () => {
		// The grant says Lumi may. The key says this caller may ask her to.
		// Both are required, or a stolen URL inherits whatever you turned on.
		await patch({ scope: "spend", granted: true }, KEY);
		const anon = await order("pay lumi 250");
		expect(anon.body.result.status).toBe("refused");
		expect(anon.body.result.result).toContain("only the creator can invoke");

		const mine = await order("pay lumi 250", KEY);
		expect(mine.body.result.status).toBe("done");
	});

	it("leaves the open half open — a cockpit is useless if nothing works", async () => {
		for (const o of ["run a cycle of 50 ticks", "audit", "sweep", "self check"]) {
			const res = await order(o);
			expect(res.body.result.status, o).toBe("done");
		}
	});

	it("a WRONG key is a 401, not a silent downgrade to anonymous", async () => {
		const res = await patch({ scope: "spend", granted: true }, "not-the-key");
		expect(res.status).toBe(401);
		const o = await order("run a cycle", "not-the-key");
		expect(o.status).toBe(401);
	});

	it("accepts the key in the body too, for a curl one-liner", async () => {
		const res = await send("PATCH", "/command/authority", { scope: "publish", granted: true, key: KEY });
		expect(res.status).toBe(200);
		expect(res.body.result.granted).toBe(true);
	});

	it("caps command volume so the bar cannot be driven by a script", async () => {
		let limited = false;
		for (let i = 0; i < 70; i++) {
			const res = await order("audit");
			if (res.status === 429) { limited = true; break; }
		}
		expect(limited, "the 60/min command cap actually bites").toBe(true);
	});

	it("closes the SIDE DOORS — value cannot move by picking a different URL", async () => {
		// Locking `POST /command {order: "pay lumi 250"}` while leaving
		// /aether/transfer open would be theatre: the scope model would describe
		// a boundary anyone could step around. Every route that moves value or
		// speaks outward must refuse an anonymous caller.
		const sideDoors: [string, unknown][] = [
			["/aether/transfer", { from: "treasury", to: "lumi", amount: 100 }],
			["/aether/reward", { to: "lumi", amount: 100 }],
			["/aether/spend", { from: "lumi", amount: 10 }],
			["/wallet/send", { from: "treasury", to: "lumi", amount: 100 }],
			["/defi/swap", { owner: "lumi", direction: "aether_in", amountIn: 10 }],
			["/defi/pool/add", { owner: "lumi", aether: 10, quote: 10 }],
			["/defi/pool/remove", { owner: "lumi", shares: 1 }],
			["/defi/vault/deposit", { owner: "lumi", amount: 10 }],
			["/defi/vault/withdraw", { owner: "lumi", amount: 10 }],
			["/defi/borrow", { owner: "lumi", collateral: 100, borrow: 10 }],
			["/defi/repay", { owner: "lumi", amount: 10 }],
			["/growth/connect", { platform: "x", token: "sneaky" }],
			["/growth/post/1/publish", {}],
			["/bridges/trust", { bridge: "local agent", caller: "attacker", trusted: true }],
		];
		for (const [path, body] of sideDoors) {
			const res = await send("POST", path, body);
			expect(res.status, `${path} must refuse an anonymous caller`).toBe(401);
		}

		// And nothing moved — refused, not partially applied. Treasury still
		// holds its genesis balance, and the ledger still reconciles.
		const t = ((await (await SELF.fetch("http://local.test/aether")).json()) as any).result;
		expect(t.reconciled).toBe(true);
		expect(t.treasury).toBe(800000);
	});

	it("the same doors open with the key", async () => {
		const move = await send("POST", "/aether/transfer", { from: "treasury", to: "lumi", amount: 100 }, KEY);
		expect(move.status).toBe(200);
		const send1 = await send("POST", "/wallet/send", { from: "treasury", to: "lumi", amount: 50 }, KEY);
		expect(send1.status).toBe(200);
	});

	it("reading is never gated — you can always see what is happening", async () => {
		for (const p of ["/aether", "/wallet", "/defi", "/bridges", "/shield", "/integrity", "/command", "/analytics/overview"]) {
			const res = await SELF.fetch(`http://local.test${p}`);
			expect(res.status, p).toBe(200);
		}
	});

	it("Shield reports the control plane's state on the security panel", async () => {
		const p = ((await (await SELF.fetch("http://local.test/shield")).json()) as any).result.posture;
		expect(p.rulesetVersion).toBe(8);
		// Shield proves the guards on every scan rather than trusting the policy
		// table — a hole there would invalidate every other authority line.
		expect(auth0(p).findings.find((f: any) => f.title.includes("do NOT")), "no unguarded routes").toBeFalsy();
		const auth = auth0(p);
		// The key IS set in tests, so the "no key" notice must be absent —
		// asserting the finding is driven by real state, not always emitted.
		expect(auth.findings.find((f: any) => f.title.includes("No creator key"))).toBeFalsy();
	});
});
