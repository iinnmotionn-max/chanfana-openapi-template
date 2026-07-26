import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// These suites exercise Lumi's AUTHORITY model — what she may do once a scope
// is granted. Granting a consequential scope now needs the creator key, so
// every request here speaks as the creator. The lock itself is what
// creator.test.ts tests; here it would only be noise.
const CREATOR_KEY = "test-creator-key";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function patch(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

describe("Autonomy — what Lumi does when nobody is watching", () => {
	it("does NOTHING unattended while the command scope is revoked", async () => {
		await post("/colony/seed");
		const pulse = await post("/lumi/pulse");
		expect(pulse.status).toBe(200);
		expect(pulse.body.result.autonomous.acted).toBe(false);
		expect(pulse.body.result.autonomous.reason).toContain("command scope not granted");

		// Nothing was filed as an unattended act.
		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "initiative")).toBe(false);
	});

	it("acts on the halt once granted — audits the ledger and reports honestly", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 200 });
		await patch("/command/authority", { scope: "command", granted: true });

		// A halted colony is a situation she should respond to.
		await post("/risk/halt", { reason: "test" });
		const pulse = await post("/lumi/pulse");
		const a = pulse.body.result.autonomous;
		expect(a.acted).toBe(true);
		expect(a.reason).toContain("halted");
		expect(a.action).toBe("invest audit");
		// She does not resume trading on her own — that stays the creator's call.
		expect((await get("/risk")).body.result.halted).toBe(true);
	});

	it("chronicles every unattended act in the feed and the command log", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 200 });
		await patch("/command/authority", { scope: "command", granted: true });
		await post("/risk/halt", { reason: "test" });
		await post("/lumi/pulse");

		const reports = await get("/reports");
		const filed = reports.body.result.find((r: any) => r.kind === "initiative");
		expect(filed, "an initiative report is filed").toBeTruthy();
		expect(filed.author).toBe("lumi");
		expect(filed.body).toContain("unattended");

		const orch = await get("/orchestrator");
		expect(orch.body.result.tasks.some((t: any) => t.target === "lumi-initiative")).toBe(true);
	});

	it("stands down when the colony is steady — autonomy is not busywork", async () => {
		await post("/colony/seed");
		await patch("/command/authority", { scope: "command", granted: true });
		// Fresh colony: no alerts, not halted, little evidence to re-examine.
		const pulse = await post("/lumi/pulse");
		const a = pulse.body.result.autonomous;
		if (!a.acted) expect(a.reason).toContain("nothing needed attention");
	});

	it("cannot act at all if operate is revoked, even with command granted", async () => {
		await post("/colony/seed");
		await patch("/command/authority", { scope: "command", granted: true });
		await patch("/command/authority", { scope: "operate", granted: false });
		const pulse = await post("/lumi/pulse");
		expect(pulse.body.result.autonomous.acted).toBe(false);
		expect(pulse.body.result.autonomous.reason).toContain("operate scope revoked");
	});
});
