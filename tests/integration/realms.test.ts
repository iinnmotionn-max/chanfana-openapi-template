import { env, SELF } from "cloudflare:test";
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

const REALM_KEYS = ["invest", "guardian", "tech", "wellness", "shield"];

const AUDIT_CHECKS = [
	"ledger-reconciliation",
	"trade-validity",
	"single-exposure",
	"capital-floor",
	"evidence-freshness",
];

const SWEEP_CHECKS = [
	"databank-online",
	"invest-ledger",
	"privacy-scan",
	"agents-heartbeat",
	"market-continuity",
];

describe("Lumi Colony — creator realms", () => {
	it("lists exactly the four realms with missions, nominal at birth", async () => {
		const realms = await get("/realms");
		expect(realms.status).toBe(200);
		expect(realms.body.success).toBe(true);

		const list = realms.body.result;
		expect(list.length).toBe(5);
		expect(list.map((r: any) => r.key).sort()).toEqual([...REALM_KEYS].sort());
		for (const realm of list) {
			expect(realm.title.length).toBeGreaterThan(0);
			expect(realm.mission.length).toBeGreaterThan(0);
			expect(realm.status).toBe("nominal");
			expect(realm.openGoals).toBeGreaterThanOrEqual(0);
			// A fresh colony has never been checked.
			expect(realm.latestCheck).toBeNull();
		}
	});

	it("invest audit passes on a freshly traded colony and leaves a paper trail", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 400 });

		const audit = await post("/realms/invest/audit");
		expect(audit.status).toBe(200);
		expect(audit.body.result.ok).toBe(true);

		const checks = audit.body.result.checks;
		expect(checks.map((c: any) => c.name)).toEqual(expect.arrayContaining(AUDIT_CHECKS));
		// A healthy colony never fails an audit check.
		for (const check of checks) {
			expect(["pass", "warn"]).toContain(check.status);
		}

		// Side effects: checks recorded and an audit report filed for invest.
		const recorded = await env.DB.prepare("SELECT COUNT(*) AS n FROM checks WHERE realm = 'invest'").first<any>();
		expect(recorded.n).toBeGreaterThanOrEqual(AUDIT_CHECKS.length);

		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "audit" && r.realm === "invest")).toBe(true);
	});

	it("catches ledger corruption: audit fails and invest goes to alert", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 400 });

		// Corrupt a balance behind Reg's back — the ledger must notice.
		await env.DB.prepare("UPDATE bots SET balance = balance + 500 WHERE id = (SELECT id FROM bots LIMIT 1)").run();

		const audit = await post("/realms/invest/audit");
		expect(audit.body.result.ok).toBe(false);
		const ledger = audit.body.result.checks.find((c: any) => c.name === "ledger-reconciliation");
		expect(ledger.status).toBe("fail");

		const realms = await get("/realms");
		const invest = realms.body.result.find((r: any) => r.key === "invest");
		expect(invest.status).toBe("alert");
	});

	it("guardian sweep passes on a healthy colony, pings agents, files a report", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 400 });

		const sweep = await post("/realms/guardian/sweep");
		expect(sweep.status).toBe(200);
		expect(sweep.body.result.ok).toBe(true);
		expect(sweep.body.result.checks.map((c: any) => c.name)).toEqual(expect.arrayContaining(SWEEP_CHECKS));

		// The sweep touches every active agent's heartbeat.
		const agents = await get("/agents");
		for (const agent of agents.body.result.filter((a: any) => a.status === "active")) {
			expect(agent.last_seen).not.toBeNull();
		}

		const reports = await get("/reports");
		expect(reports.body.result.some((r: any) => r.kind === "sweep" && r.realm === "guardian")).toBe(true);
	});

	it("privacy scan flags PII left in wellness notes", async () => {
		await post("/colony/seed");
		await post("/realms/wellness/checkin", {
			mood: 3,
			energy: 3,
			note: "email me at creator@example.com about this",
		});

		const sweep = await post("/realms/guardian/sweep");
		const privacy = sweep.body.result.checks.find((c: any) => c.name === "privacy-scan");
		expect(privacy.status).toBe("warn");
	});

	it("tech status reports table counts, active bots, and every realm", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 400 });

		const status = await get("/realms/tech/status");
		expect(status.status).toBe(200);
		const r = status.body.result;

		expect(Object.keys(r.tables).length).toBeGreaterThanOrEqual(10);
		for (const table of ["bots", "trades", "realms", "checks", "wellness_checkins"]) {
			expect(r.tables).toHaveProperty(table);
		}
		expect(r.tables.trades).toBeGreaterThan(0);
		expect(r.marketTick).toBe(400);
		expect(r.activeBots).toBe(3);
		expect(r.activeStrategies).toBeGreaterThan(0);
		expect(Object.keys(r.realmStatuses).sort()).toEqual([...REALM_KEYS].sort());
	});

	it("wellness: check-ins record, summarize, and validate ranges", async () => {
		const checkin = await post("/realms/wellness/checkin", { mood: 4, energy: 2, note: "long day" });
		expect(checkin.status).toBe(201);

		const wellness = await get("/realms/wellness");
		expect(wellness.status).toBe(200);
		const r = wellness.body.result;
		expect(r.count).toBe(1);
		expect(r.last.mood).toBe(4);
		expect(r.last.energy).toBe(2);
		expect(r.last.note).toBe("long day");
		expect(r.avg7).not.toBeNull();
		expect(r.avg7.mood).toBe(4);
		expect(r.avg7.energy).toBe(2);

		// Out-of-range moods are rejected, not clamped.
		const tooHigh = await post("/realms/wellness/checkin", { mood: 9, energy: 3 });
		expect(tooHigh.status).toBe(400);

		// A check-in files a wellness report so it shows in the feed.
		const reports = await get("/reports");
		expect(reports.body.result.some((rep: any) => rep.kind === "wellness" && rep.realm === "wellness")).toBe(true);
	});

	it("engine cycles learn inline when asked, and never pause healthy bots", async () => {
		await post("/colony/seed");

		const learned = await post("/engine/run", { ticks: 600, learn: true });
		expect(learned.status).toBe(200);
		expect(learned.body.result.learned).not.toBeNull();
		expect(learned.body.result.learned.scores.length).toBeGreaterThanOrEqual(3);

		const plain = await post("/engine/run", { ticks: 100 });
		expect(plain.body.result.learned).toBeNull();

		// Kill-switch bookkeeping: present, and zero on a normal short run.
		expect(plain.body.result.paused).toBe(0);

		// Every active bot sits above the 40% capital floor.
		const bots = await get("/bots");
		for (const bot of bots.body.result.filter((b: any) => b.status === "active")) {
			expect(bot.balance).toBeGreaterThanOrEqual(bot.starting_balance * 0.4);
		}
	});

	it("analytics overview carries the whole cockpit: realms, checks, wellness", async () => {
		await post("/colony/seed");
		await post("/engine/run", { ticks: 400 });
		await post("/realms/guardian/sweep");
		await post("/realms/wellness/checkin", { mood: 5, energy: 4, note: "shipping" });

		const overview = await get("/analytics/overview");
		expect(overview.status).toBe(200);
		const r = overview.body.result;
		expect(r.realms.length).toBe(5);
		expect(r.checks.length).toBeGreaterThan(0);
		expect(r.wellness.count).toBeGreaterThanOrEqual(1);
		expect(r.wellness.last).not.toBeNull();
	});
});
