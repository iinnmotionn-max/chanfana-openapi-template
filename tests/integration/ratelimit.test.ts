import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any, retryAfter: res.headers.get("Retry-After") };
}

const RP = "test-rp-secret";
const AGENT = "test-agent-secret";

describe("Rate limiting — guessing a secret has to cost time", () => {
	it("locks the RP door after repeated bad secrets — and the lockout beats a CORRECT one", async () => {
		// Five bad guesses are absorbed; the sixth trips the lockout.
		for (let i = 0; i < 6; i++) {
			await post("/rp/grant", { userId: 1, amount: 1, secret: `guess-${i}` });
		}
		const locked = await post("/rp/grant", { userId: 1, amount: 1, secret: "guess-x" });
		expect(locked.status).toBe(429);
		expect(locked.retryAfter, "Retry-After header is set").toBeTruthy();
		expect(Number(locked.retryAfter)).toBeGreaterThan(0);

		// The point of a lockout: even the RIGHT secret is refused while it holds.
		// Otherwise an attacker just keeps guessing until one lands.
		const correctButLocked = await post("/rp/grant", { userId: 1, amount: 1, secret: RP });
		expect(correctButLocked.status).toBe(429);
	});

	it("locks the local-agent door the same way", async () => {
		for (let i = 0; i < 7; i++) {
			await post("/local/next", { secret: `nope-${i}` });
		}
		const locked = await post("/local/next", { secret: AGENT });
		expect(locked.status).toBe(429);
		expect(Number(locked.retryAfter)).toBeGreaterThan(0);
	});

	it("a valid caller is not punished for an earlier fumble", async () => {
		// Under the threshold, then succeed — the failure count is forgiven.
		await post("/local/next", { secret: "typo-once" });
		await post("/local/next", { secret: "typo-twice" });
		const ok = await post("/local/next", { secret: AGENT, host: "test-box" });
		expect(ok.status).toBe(200);

		// And having succeeded, more fumbles start from a clean slate rather
		// than tipping straight into a lockout.
		await post("/local/next", { secret: "typo-again" });
		const stillFine = await post("/local/next", { secret: AGENT, host: "test-box" });
		expect(stillFine.status).toBe(200);
	});

	it("the doors lock independently — one bridge does not take down the other", async () => {
		for (let i = 0; i < 8; i++) {
			await post("/rp/grant", { userId: 2, amount: 1, secret: `bad-${i}` });
		}
		expect((await post("/rp/grant", { userId: 2, amount: 1, secret: RP })).status).toBe(429);
		// The local agent is untouched by the RP lockout.
		expect((await post("/local/next", { secret: AGENT, host: "test-box" })).status).toBe(200);
	});

	it("Shield raises a CRITICAL finding while a door is locked — a live attack signal", async () => {
		for (let i = 0; i < 8; i++) {
			await post("/rp/grant", { userId: 3, amount: 1, secret: `attack-${i}` });
		}
		const res = await SELF.fetch("http://local.test/shield");
		const p = ((await res.json()) as any).result.posture;
		const auth = p.dimensions.find((d: any) => d.dimension === "authority");
		const alarm = auth.findings.find((f: any) => f.title.includes("locked out right now"));
		expect(alarm, "active lockout surfaced").toBeTruthy();
		expect(alarm.severity).toBe("critical");
		expect(alarm.detail).toContain("auth:rp");
	});

	it("normal traffic passes untouched — the limit is not in an honest caller's way", async () => {
		for (let i = 0; i < 20; i++) {
			const res = await post("/local/next", { secret: AGENT, host: "test-box" });
			expect(res.status, `poll ${i}`).toBe(200);
		}
	});
});
