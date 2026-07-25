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
async function patch(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

describe("Total Command — one bar, all control, behind the authority ledger", () => {
	it("lists every capability and the authority ledger, with the honest boundary", async () => {
		const res = await get("/command");
		expect(res.status).toBe(200);
		const { capabilities, authority, boundary } = res.body.result;
		expect(capabilities.length).toBeGreaterThanOrEqual(14);
		for (const id of ["trade", "learn", "audit", "sweep", "scan", "halt", "pay", "pulse", "council"]) {
			expect(capabilities.some((c: any) => c.id === id), `${id} registered`).toBe(true);
		}
		// Safe scopes start granted; value/outward ones start revoked.
		const byScope = Object.fromEntries(authority.map((a: any) => [a.scope, a.granted]));
		expect(byScope.observe).toBe(true);
		expect(byScope.operate).toBe(true);
		expect(byScope.spend).toBe(false);
		expect(byScope.publish).toBe(false);
		expect(byScope.command).toBe(false);
		// The boundary is stated, not hidden.
		expect(boundary).toContain("cannot control your computer");
	});

	it("routes a plain-English order to the right capability and runs it for real", async () => {
		await post("/colony/seed");
		const res = await post("/command", { order: "run a cycle of 300 ticks" });
		expect(res.status).toBe(200);
		expect(res.body.result.capability).toBe("trade");
		expect(res.body.result.status).toBe("done");
		expect(res.body.result.result).toContain("traded 300 ticks");

		// The market really advanced.
		const overview = await get("/analytics/overview");
		expect(overview.body.result.colony.tick).toBeGreaterThanOrEqual(300);
	});

	it("halts and resumes trading on command", async () => {
		await post("/colony/seed");
		const halt = await post("/command", { order: "emergency stop" });
		expect(halt.body.result.capability).toBe("halt");
		expect((await get("/risk")).body.result.halted).toBe(true);

		const resume = await post("/command", { order: "resume trading" });
		expect(resume.body.result.capability).toBe("resume");
		expect((await get("/risk")).body.result.halted).toBe(false);
	});

	it("REFUSES a spend order until the creator grants the scope, then obeys", async () => {
		await post("/colony/seed");
		const refused = await post("/command", { order: "pay lumi 250" });
		expect(refused.body.result.status).toBe("refused");
		expect(refused.body.result.scope).toBe("spend");
		expect(refused.body.result.result).toContain("SPEND");

		// Nothing moved.
		const before = await get("/aether");
		const lumiBefore = before.body.result.accounts.find((a: any) => a.owner === "lumi").balance;

		// Creator grants the scope.
		const grant = await patch("/command/authority", { scope: "spend", granted: true });
		expect(grant.body.result.granted).toBe(true);

		const done = await post("/command", { order: "pay lumi 250" });
		expect(done.body.result.status).toBe("done");
		const after = await get("/aether");
		const lumiAfter = after.body.result.accounts.find((a: any) => a.owner === "lumi").balance;
		expect(lumiAfter).toBe(lumiBefore + 250);
		// Supply still conserved — command doesn't mint.
		expect(after.body.result.reconciled).toBe(true);
	});

	it("says so plainly when no capability matches, and logs the attempt", async () => {
		const res = await post("/command", { order: "make me a sandwich" });
		expect(res.body.result.status).toBe("unrouted");
		expect(res.body.result.capability).toBeNull();
		expect(res.body.result.result).toContain("No capability matches");

		const orch = await get("/orchestrator");
		expect(orch.body.result.tasks.some((t: any) => t.kind === "command")).toBe(true);
	});

	it("rejects an unknown authority scope with 400", async () => {
		const res = await patch("/command/authority", { scope: "godmode", granted: true });
		expect(res.status).toBe(400);
	});

	it("the analytics overview carries command + authority for the cockpit", async () => {
		const res = await get("/analytics/overview");
		expect(res.body.result.command.capabilities.length).toBeGreaterThanOrEqual(14);
		expect(res.body.result.command.authority.length).toBe(5);
	});
});
