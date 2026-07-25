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

const authorityDim = (shield: any) => shield.dimensions.find((d: any) => d.dimension === "authority");

describe("Shield audits blast radius — granted power is scored, not ignored", () => {
	it("scores the authority dimension and names the enabled bridges", async () => {
		const res = await get("/shield");
		expect(res.status).toBe(200);
		const auth = authorityDim(res.body.result.posture ?? res.body.result);
		expect(auth, "authority dimension present").toBeTruthy();
		expect(auth.label).toBe("Authority & blast radius");
		// The test env binds LOCAL_AGENT_SECRET and RP_SHARED_SECRET, so Shield
		// should surface them as inbound attack surface even before any grant.
		const bridge = auth.findings.find((f: any) => f.title.includes("bridge"));
		expect(bridge, "enabled bridges reported").toBeTruthy();
		expect(bridge.detail).toContain("local agent");
	});

	it("LOWERS the posture score as dangerous scopes are granted", async () => {
		await post("/colony/seed");
		const before = (await post("/shield/scan")).body.result;
		const authBefore = authorityDim(before).score;

		await patch("/command/authority", { scope: "machine", granted: true });
		await patch("/command/authority", { scope: "spend", granted: true });

		const after = (await post("/shield/scan")).body.result;
		const authAfter = authorityDim(after).score;

		// Granting machine + spend must cost posture — a wider blast radius is
		// a worse security position, and the score has to say so.
		expect(authAfter).toBeLessThan(authBefore);
		expect(after.score).toBeLessThan(before.score);

		const titles = authorityDim(after).findings.map((f: any) => f.title);
		expect(titles).toContain("Machine reach granted");
		expect(titles).toContain("Spend granted");
	});

	it("recovers the score when the creator revokes a scope again", async () => {
		await post("/colony/seed");
		await patch("/command/authority", { scope: "machine", granted: true });
		const granted = authorityDim((await post("/shield/scan")).body.result).score;

		await patch("/command/authority", { scope: "machine", granted: false });
		const revoked = authorityDim((await post("/shield/scan")).body.result).score;

		expect(revoked).toBeGreaterThan(granted);
	});

	it("keeps the ruleset version and count honest as rules grow", async () => {
		const res = await get("/shield");
		const p = res.body.result.posture ?? res.body.result;
		expect(p.rulesetVersion).toBeGreaterThanOrEqual(4);
		expect(p.ruleCount).toBeGreaterThanOrEqual(17);
		expect(p.dimensions.length).toBe(6);
	});
});
