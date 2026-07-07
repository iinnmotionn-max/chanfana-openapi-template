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

describe("Growth v2 — connectors, deals, analytics", () => {
	it("lists posting connectors, none live without credentials", async () => {
		const c = await get("/growth/connectors");
		expect(c.status).toBe(200);
		expect(c.body.result.map((x: any) => x.platform).sort()).toEqual(["blog", "instagram", "linkedin", "x"]);
		for (const conn of c.body.result) {
			expect(conn.live).toBe(false);
			expect(conn.connected).toBe(false);
			expect(conn.note).toContain("_TOKEN");
		}
	});

	it("connect + publish is honest: local until the connector is live", async () => {
		const conn = await post("/growth/connect", { platform: "x", handle: "lumi" });
		expect(conn.status).toBe(200);
		expect(conn.body.result.status).toBe("connected");

		const draft = await post("/growth/post", { platform: "x" });
		const id = draft.body.result.id;
		const pub = await post(`/growth/post/${id}/publish`);
		expect(pub.status).toBe(200);
		expect(pub.body.result.status).toBe("published");
		// No X_TOKEN in the test env → local, not a real post.
		expect(pub.body.result.posted).toBe(false);
		expect(pub.body.result.note).toContain("X_TOKEN");

		const missing = await post("/growth/post/99999/publish");
		expect(missing.status).toBe(404);
	});

	it("runs a weighted deals pipeline", async () => {
		await post("/growth/deal", { name: "Cetus listing", partner: "Cetus", value: 40000, probability: 0.5 });
		const d2 = await post("/growth/deal", { name: "Fund intro", partner: "Sui Fund", value: 20000, probability: 0.25 });
		expect(d2.status).toBe(201);

		const pipe = await get("/growth/deals");
		// weighted = 40000*0.5 + 20000*0.25 = 25000
		expect(pipe.body.result.weightedValue).toBe(25000);

		const won = await patch(`/growth/deal/${d2.body.result.id}`, { stage: "won" });
		expect(won.body.result.stage).toBe("won");
		const after = await get("/growth/deals");
		expect(after.body.result.wonValue).toBe(20000);
		expect(after.body.result.byStage.won).toBe(1);

		const badStage = await patch(`/growth/deal/${d2.body.result.id}`, { stage: "nope" });
		expect(badStage.status).toBe(400);
		const missing = await patch("/growth/deal/99999", { stage: "won" });
		expect(missing.status).toBe(404);
	});

	it("campaign analytics roll up posts and pipeline", async () => {
		await post("/growth/post", { platform: "linkedin" });
		await post("/growth/post", { platform: "x" });
		const a = await get("/growth/analytics");
		expect(a.status).toBe(200);
		expect(Array.isArray(a.body.result.campaigns.campaigns)).toBe(true);
		expect(a.body.result.campaigns.totals.total).toBeGreaterThan(0);
		expect(a.body.result.deals).toBeTruthy();
		expect(a.body.result.connectors.length).toBe(4);
	});

	it("analytics overview carries the deal pipeline under growth", async () => {
		await post("/growth/deal", { name: "x", value: 1000, probability: 0.5 });
		const overview = await get("/analytics/overview");
		expect(overview.body.result.growth.deals).toBeTruthy();
		expect(typeof overview.body.result.growth.deals.weightedValue).toBe("number");
	});
});
