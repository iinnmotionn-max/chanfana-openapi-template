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

const PLATFORMS = ["x", "linkedin", "instagram", "blog"] as const;

describe("Growth — PR, content, and lead-gen", () => {
	it("registers a 'growth' realm", async () => {
		const realms = await get("/realms");
		expect(realms.status).toBe(200);
		const growth = realms.body.result.find((r: any) => r.key === "growth");
		expect(growth).toBeTruthy();
		expect(growth.title).toBe("Growth");
		expect(growth.mission.length).toBeGreaterThan(0);
	});

	it("drafts platform-tuned posts, each with a body and media_prompt", async () => {
		for (const platform of PLATFORMS) {
			const res = await post("/growth/post", { platform, topic: "Lumi + AETHER launch" });
			expect(res.status).toBe(201);
			const p = res.body.result;
			expect(p.platform).toBe(platform);
			expect(p.body.length).toBeGreaterThan(0);
			expect(p.media_prompt.length).toBeGreaterThan(0);
			expect(p.status).toBe("draft");
		}
		// The x post reads like a tweet: it carries at least one hashtag.
		const x = await post("/growth/post", { platform: "x" });
		expect(x.body.result.body).toContain("#");
	});

	it("moves a draft draft → queued → published, and 404s an unknown id", async () => {
		const draft = await post("/growth/post", { platform: "linkedin" });
		const id = draft.body.result.id;
		expect(draft.body.result.status).toBe("draft");

		const queued = await patch(`/growth/post/${id}`, { status: "queued" });
		expect(queued.status).toBe(200);
		expect(queued.body.result.status).toBe("queued");

		const published = await patch(`/growth/post/${id}`, { status: "published" });
		expect(published.status).toBe(200);
		expect(published.body.result.status).toBe("published");
		// Honesty: publishing is local only.
		expect(published.body.result.note.toLowerCase()).toContain("connect an account");

		const missing = await patch("/growth/post/999999", { status: "queued" });
		expect(missing.status).toBe(404);
	});

	it("creates a campaign and logs leads that show up in the pipeline", async () => {
		const campaign = await post("/growth/campaign", { name: "Launch week", goal: "Announce AETHER" });
		expect(campaign.status).toBe(201);
		expect(campaign.body.result.name).toBe("Launch week");

		const beforeLeads = (await get("/growth/leads")).body.result.length;

		const kinds = [
			{ name: "Sui Foundation", kind: "partner", value: 10000 },
			{ name: "Acme Placement Desk", kind: "placement", value: 3000 },
			{ name: "Alpha Ventures", kind: "investor", value: 50000 },
		];
		for (const k of kinds) {
			const res = await post("/growth/lead", { name: k.name, kind: k.kind, value: k.value });
			expect(res.status).toBe(201);
			expect(res.body.result.kind).toBe(k.kind);
		}

		const leads = await get("/growth/leads");
		expect(leads.body.result.length).toBe(beforeLeads + 3);
		for (const k of kinds) {
			expect(leads.body.result.some((l: any) => l.name === k.name)).toBe(true);
		}

		const overview = await get("/growth");
		expect(overview.body.result.funnel.leads).toBeGreaterThanOrEqual(3);
		expect(overview.body.result.leads.pipelineValue).toBeGreaterThanOrEqual(63000);
	});

	it("scouts curated opportunities without duplicating on re-run and files a report", async () => {
		const first = await post("/growth/scout");
		expect(first.status).toBe(200);
		expect(first.body.result.found).toBeGreaterThanOrEqual(3);
		expect(first.body.result.stored).toBeGreaterThan(0);

		const second = await post("/growth/scout");
		// Dedup by name: a second scout stores fewer (usually zero) new leads.
		expect(second.body.result.stored).toBeLessThanOrEqual(first.body.result.stored);
		expect(second.body.result.stored).toBe(0);

		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "scout" && r.realm === "growth")).toBe(true);
	});

	it("overview carries campaigns, post status breakdown, and lead kinds", async () => {
		await post("/growth/campaign", { name: "Evergreen" });
		await post("/growth/post", { platform: "blog" });
		await post("/growth/lead", { name: "Press Weekly", kind: "press" });

		const overview = await get("/growth");
		expect(overview.status).toBe(200);
		const r = overview.body.result;
		expect(Array.isArray(r.campaigns)).toBe(true);
		expect(r.campaigns.length).toBeGreaterThanOrEqual(1);
		expect(r.posts.byStatus).toHaveProperty("draft");
		expect(r.posts.byStatus).toHaveProperty("queued");
		expect(r.posts.byStatus).toHaveProperty("published");
		expect(r.leads.byKind).toBeTruthy();
		expect(Object.keys(r.leads.byKind).length).toBeGreaterThan(0);
	});
});
