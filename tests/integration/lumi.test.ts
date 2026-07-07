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

async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

describe("Lumi Colony — Lumi's evolution", () => {
	it("starts at level 1 with four skills and a seeded quest line", async () => {
		const lumi = await get("/lumi");
		expect(lumi.status).toBe(200);
		const r = lumi.body.result;
		expect(r.level).toBe(1);
		expect(r.totalXp).toBe(0);
		for (const skill of ["insight", "vigilance", "engineering", "empathy"]) {
			expect(r.skills[skill]).toEqual({ xp: 0, level: 1 });
		}
		expect(r.quests.length).toBe(13);
		expect(r.quests.every((q: any) => q.status === "open")).toBe(true);
	});

	it("pulses: trades, learns, audits, sweeps, completes quests, and grows", async () => {
		await post("/colony/seed");
		const pulse = await post("/lumi/pulse");
		expect(pulse.status).toBe(200);
		const r = pulse.body.result;

		expect(r.cycle.closed).toBeGreaterThan(0);
		expect(r.auditOk).toBe(true);
		expect(r.sweepOk).toBe(true);
		expect(r.decisions.length).toBeGreaterThan(0);
		// Real work earns real XP.
		expect(r.lumi.totalXp).toBeGreaterThan(0);
		expect(r.lumi.pulses).toBe(1);
		// The seeded colony completes "Open for business" on the first pulse.
		expect(r.questsCompleted.map((q: any) => q.title)).toContain("Open for business");

		// Situational awareness: she knows her stage and picks an initiative,
		// and she sets herself a live goal in the Databank to pursue it.
		expect(r.awareness.stage).toBe("Hatchling");
		expect(r.awareness.statement).toContain("level");
		expect(r.awareness.initiative).not.toBeNull();
		const goals = await get("/goals");
		expect(goals.body.result.some((g: any) => String(g.title).startsWith("Lumi initiative:"))).toBe(true);

		// The pulse itself is chronicled and measured.
		const reports = await get("/reports");
		expect(reports.body.result.some((rep: any) => rep.kind === "pulse" && rep.author === "lumi")).toBe(true);
		const tech = await get("/realms/tech/status");
		const kinds = tech.body.result.perf.map((p: any) => p.kind);
		expect(kinds).toEqual(expect.arrayContaining(["cycle_ms", "audit_ms", "sweep_ms", "pulse_ms"]));
	});

	it("grows empathy from creator check-ins", async () => {
		await post("/realms/wellness/checkin", { mood: 5, energy: 4, note: "" });
		const lumi = await get("/lumi");
		expect(lumi.body.result.skills.empathy.xp).toBeGreaterThanOrEqual(20);
	});

	it("insight drives the brood when the champion evolves", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 600 });
		const learn = await post("/engine/learn");
		expect(learn.body.result.evolved).not.toBeNull();
		expect(learn.body.result.brood).toBeGreaterThanOrEqual(1);
	});

	it("gives the creator direct bot control via PATCH /bots/:id", async () => {
		await post("/colony/seed");
		const bots = await get("/bots");
		const id = bots.body.result[0].id;

		const res = await SELF.fetch(`http://local.test/bots/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "paused" }),
		});
		const body = (await res.json()) as any;
		expect(res.status).toBe(200);
		expect(body.result.status).toBe("paused");
		// The command is chronicled in the feed.
		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "command")).toBe(true);

		const missing = await SELF.fetch(`http://local.test/bots/99999`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "active" }),
		});
		expect(missing.status).toBe(404);
	});

	it("research and scout respond gracefully with or without network access", async () => {
		// External APIs may be unreachable in the test sandbox — the endpoints
		// must still answer cleanly with found/errors rather than throwing.
		const researched = await post("/lumi/research", { query: "trading" });
		expect(researched.status).toBe(200);
		expect(Array.isArray(researched.body.result.found)).toBe(true);
		expect(Array.isArray(researched.body.result.errors)).toBe(true);

		const scouted = await post("/lumi/scout");
		expect(scouted.status).toBe(200);
		expect(typeof scouted.body.result.stored).toBe("boolean");

		const knowledge = await get("/knowledge");
		expect(knowledge.status).toBe(200);
		expect(Array.isArray(knowledge.body.result)).toBe(true);

		const bad = await post("/lumi/research", {});
		expect(bad.status).toBe(400);
	});

	it("aura layer: profiles with consent rules, briefs, and no creator profiling", async () => {
		// Consent rule: notes without consent are refused.
		const noConsent = await post("/auras", { name: "Acme Corp", kind: "client", notes: "met at conference" });
		expect(noConsent.status).toBe(400);

		// The creator is never profiled.
		const creator = await post("/auras", { name: "The Creator", kind: "user" });
		expect(creator.status).toBe(400);

		const created = await post("/auras", {
			name: "Acme Corp",
			kind: "client",
			personality: "driver, decisive",
			traits: { palette: "brand red on black" },
			notes: "prefers weekly summaries",
			consent: true,
		});
		expect(created.status).toBe(201);
		expect(created.body.result.brief.archetype).toBe("driver");
		expect(created.body.result.brief.palette).toBe("brand red on black");

		const brief = await get(`/auras/${created.body.result.id}/brief`);
		expect(brief.status).toBe(200);
		expect(brief.body.result.brief.tone).toContain("direct");

		// Empathy grows from understanding people; the sweep stays clean.
		const lumi = await get("/lumi");
		expect(lumi.body.result.skills.empathy.xp).toBeGreaterThanOrEqual(15);
		const sweep = await post("/realms/guardian/sweep");
		const consent = sweep.body.result.checks.find((c: any) => c.name === "aura-consent");
		expect(consent.status).toBe("pass");
	});

	it("guardian catches PII and consent violations in auras", async () => {
		await post("/auras", {
			name: "Leaky Client",
			kind: "client",
			personality: "amiable",
			notes: "email them at leak@example.com",
			consent: true,
		});
		const sweep = await post("/realms/guardian/sweep");
		const privacy = sweep.body.result.checks.find((c: any) => c.name === "privacy-scan");
		expect(privacy.status).toBe("warn");
		expect(privacy.detail).toContain("aura");
	});

	it("exposes lumi, quests, and perf in the analytics overview", async () => {
		await post("/colony/seed");
		await post("/lumi/pulse");
		const overview = await get("/analytics/overview");
		const r = overview.body.result;
		expect(r.lumi.totalXp).toBeGreaterThan(0);
		expect(r.quests.length).toBe(13);
		expect(r.perf.length).toBeGreaterThan(0);
		expect(r.quests.some((q: any) => q.status === "done")).toBe(true);
	});
});
