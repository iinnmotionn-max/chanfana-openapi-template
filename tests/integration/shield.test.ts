import { SELF, env } from "cloudflare:test";
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

describe("Shield — web3 security, red-team, decentralization, KYC", () => {
	it("scores a composite security posture across six dimensions", async () => {
		const s = await get("/shield");
		expect(s.status).toBe(200);
		const p = s.body.result.posture;
		expect(p.score).toBeGreaterThanOrEqual(0);
		expect(p.score).toBeLessThanOrEqual(100);
		expect(["A", "B", "C", "D", "F"]).toContain(p.grade);
		expect(p.dimensions.map((d: any) => d.dimension).sort()).toEqual(
			["authority", "contract", "custody", "decentralization", "privacy", "redteam"],
		);
		expect(p.rulesetVersion).toBeGreaterThanOrEqual(1);
		expect(p.ruleCount).toBeGreaterThan(5);
	});

	it("a red-team scan records findings and updates the shield realm", async () => {
		const scan = await post("/shield/scan");
		expect(scan.status).toBe(200);
		// Off-chain + un-KYC'd starts with advisory findings, none critical on a clean colony.
		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "shield" && r.realm === "shield")).toBe(true);
		const realms = await get("/realms");
		expect(realms.body.result.find((r: any) => r.key === "shield")).toBeTruthy();
	});

	it("red-team catches tampered token supply as a critical", async () => {
		await env.DB.prepare("UPDATE aether_accounts SET balance = balance + 5000 WHERE owner = 'lumi'").run();
		const scan = await post("/shield/scan");
		const red = scan.body.result.dimensions.find((d: any) => d.dimension === "redteam");
		expect(red.score).toBeLessThan(1);
		expect(red.findings.some((f: any) => f.severity === "critical")).toBe(true);
		expect(scan.body.result.score).toBeLessThan(100);
	});

	it("records privacy-first KYC attestations (hash only) and rejects PII", async () => {
		const ok = await post("/shield/kyc", {
			subject: "wallet-0xabc",
			level: "verified",
			method: "zk",
			attestationHash: "0x9f2c4e7a1b8d3c5e",
		});
		expect(ok.status).toBe(201);
		expect(ok.body.result.level).toBe("verified");

		// Anything that looks like raw identity is refused.
		const pii = await post("/shield/kyc", {
			subject: "x",
			level: "basic",
			attestationHash: "john@example.com",
		});
		expect(pii.status).toBe(400);

		const s = await get("/shield");
		expect(s.body.result.kyc.total).toBeGreaterThanOrEqual(1);
	});

	it("improving posture is tracked as a learning trend", async () => {
		await post("/shield/scan");
		await post("/shield/scan");
		const s = await get("/shield");
		expect(Array.isArray(s.body.result.trend)).toBe(true);
		expect(s.body.result.trend.length).toBeGreaterThanOrEqual(2);
	});

	it("analytics overview carries the shield posture", async () => {
		const overview = await get("/analytics/overview");
		expect(overview.body.result.shield).toBeTruthy();
		expect(overview.body.result.shield.posture.dimensions.length).toBe(6);
	});
});
