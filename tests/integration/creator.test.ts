import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// The authority ledger was built as the boundary on Lumi's power — but the
// endpoint that WRITES the ledger was open to anyone who knew the URL. An
// attacker's first move was simply to grant themselves the scope they wanted.
// These tests are the proof that move no longer works.

const KEY = "test-creator-key";

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

	it("Shield reports the control plane's state on the security panel", async () => {
		const p = ((await (await SELF.fetch("http://local.test/shield")).json()) as any).result.posture;
		expect(p.rulesetVersion).toBe(7);
		const auth = p.dimensions.find((d: any) => d.dimension === "authority");
		// The key IS set in tests, so the "no key" notice must be absent —
		// asserting the finding is driven by real state, not always emitted.
		expect(auth.findings.find((f: any) => f.title.includes("No creator key"))).toBeFalsy();
	});
});
