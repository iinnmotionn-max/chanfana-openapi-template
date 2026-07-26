import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Moving value and publishing outward now need the creator key — locking the
// command bar while leaving these endpoints open would only have moved the
// hole. These suites test the mechanics, so they speak as the creator;
// creator.test.ts is where the lock itself is proven.
const CREATOR_KEY = "test-creator-key";

// The third way a shared secret goes wrong. Guessing is caught by the lockout,
// a known leak is handled by rotation — but a COPIED secret produces traffic
// identical to yours, except from a machine you have never seen.

const AGENT = "test-agent-secret";
const RP = "test-rp-secret";

async function post(path: string, body: unknown) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function bridges() {
	return ((await (await SELF.fetch("http://local.test/bridges")).json()) as any).result;
}
async function authorityFindings() {
	const p = ((await (await SELF.fetch("http://local.test/shield")).json()) as any).result.posture;
	return p.dimensions.find((d: any) => d.dimension === "authority").findings;
}

describe("Bridge callers — noticing a machine that isn't yours", () => {
	it("learns each caller and counts its calls", async () => {
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		const r = await bridges();
		const pc = r.callers.find((c: any) => c.caller === "studio-pc");
		expect(pc.bridge).toBe("local agent");
		expect(pc.calls).toBe(2);
	});

	it("the FIRST caller on a bridge is unremarkable — that's just setup", async () => {
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		const r = await bridges();
		expect(r.callers[0].trusted, "the baseline caller is trusted on arrival").toBe(true);
		expect(r.unknown).toBe(0);
		// Nothing to ask about yet, so Shield says nothing.
		const f = await authorityFindings();
		expect(f.find((x: any) => x.title.includes("unrecognized"))).toBeFalsy();
	});

	it("a SECOND, unfamiliar caller is what raises the question", async () => {
		await post("/local/next", { secret: AGENT, host: "studio-pc" });   // baseline
		await post("/local/next", { secret: AGENT, host: "unknown-vps" }); // stranger

		const r = await bridges();
		expect(r.unknown).toBe(1);
		const stranger = r.callers.find((c: any) => c.caller === "unknown-vps");
		expect(stranger.trusted).toBe(false);

		const finding = (await authorityFindings()).find((x: any) => x.title.includes("unrecognized"));
		expect(finding).toBeTruthy();
		expect(finding.detail).toContain("unknown-vps");
		// It must offer both readings, because both are plausible.
		expect(finding.detail).toContain("If that's yours");
		expect(finding.detail).toContain("rotate");
	});

	it("says plainly that a caller name proves nothing", async () => {
		await post("/local/next", { secret: AGENT, host: "a" });
		await post("/local/next", { secret: AGENT, host: "b" });
		const r = await bridges();
		expect(r.note).toContain("self-reported");
		const finding = (await authorityFindings()).find((x: any) => x.title.includes("unrecognized"));
		expect(finding.detail, "the caveat travels with the alert, not just the docs").toContain("spoofed");
	});

	it("trusting a caller answers the question for good", async () => {
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		await post("/local/next", { secret: AGENT, host: "laptop" });
		expect((await bridges()).unknown).toBe(1);

		const ok = await post("/bridges/trust", { bridge: "local agent", caller: "laptop", trusted: true });
		expect(ok.status).toBe(200);
		expect(ok.body.result.trusted).toBe(true);

		expect((await bridges()).unknown).toBe(0);
		expect((await authorityFindings()).find((x: any) => x.title.includes("unrecognized"))).toBeFalsy();

		// And it stays answered as that caller keeps working.
		await post("/local/next", { secret: AGENT, host: "laptop" });
		expect((await bridges()).unknown).toBe(0);
	});

	it("trust can be taken back when it was given by mistake", async () => {
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		const res = await post("/bridges/trust", { bridge: "local agent", caller: "studio-pc", trusted: false });
		expect(res.body.result.trusted).toBe(false);
		expect((await bridges()).unknown).toBe(1);
	});

	it("refuses to vouch for a caller that has never been seen", async () => {
		const res = await post("/bridges/trust", { bridge: "local agent", caller: "never-called", trusted: true });
		expect(res.status).toBe(400);
		expect(res.body.errors[0].message).toContain("never-called");
	});

	it("tracks the two bridges separately — a Roblox place is not an agent host", async () => {
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		await post("/rp/grant", { userId: 7001, amount: 1, secret: RP, place: "place-123" });
		const r = await bridges();
		expect(r.callers.find((c: any) => c.caller === "place-123").bridge).toBe("roblox city");
		expect(r.callers.find((c: any) => c.caller === "studio-pc").bridge).toBe("local agent");
		// Each bridge gets its own baseline, so neither flags the other.
		expect(r.unknown).toBe(0);
	});

	it("an unnamed caller is not invented as a stranger", async () => {
		// /local/result carries no host. That must not manufacture a phantom
		// caller, or the panel fills with noise nobody can act on.
		await post("/local/next", { secret: AGENT, host: "studio-pc" });
		await post("/local/result", { secret: AGENT, id: 1, status: "done", result: "ok" });
		const r = await bridges();
		expect(r.callers.length).toBe(1);
		expect(r.unknown).toBe(0);
	});
});
