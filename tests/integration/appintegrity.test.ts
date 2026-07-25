import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// These tests do the thing that matters for a self-check: they BREAK the app
// on purpose and demand that the check notices. A structural audit that only
// ever passes is decoration — it has never been shown to be capable of failing.

async function integrity() {
	const res = await SELF.fetch("http://local.test/integrity");
	return ((await res.json()) as any).result;
}
function check(report: any, name: string) {
	return report.checks.find((c: any) => c.name === name);
}

describe("App integrity — has the code drifted from the database?", () => {
	it("reports green on a healthy app, and every check names its area", async () => {
		const r = await integrity();
		expect(r.counts.fail, JSON.stringify(r.checks.filter((c: any) => c.status === "fail"))).toBe(0);
		expect(r.score).toBeGreaterThan(80);
		for (const c of r.checks) {
			expect(["schema", "wiring", "referential", "value", "config"]).toContain(c.area);
		}
	});

	it("proves every command trigger reaches its OWN capability", async () => {
		// The router takes the longest matching trigger. Add a capability whose
		// trigger is a substring of a longer one and it becomes unreachable —
		// silently, with no error anywhere. This check is the only thing that
		// would ever catch that.
		const c = check(await integrity(), "capability-routing");
		expect(c.status).toBe("pass");
		expect(c.detail).toMatch(/route to their own capability/);
	});

	it("CATCHES a realm key the cockpit cannot render", async () => {
		// A single typo'd realm on an INSERT means those reports are written and
		// never displayed. Nothing throws; the feature just quietly vanishes.
		await env.DB.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg','test','typo','', '{}', 'invesst')").run();
		const c = check(await integrity(), "realm-keys");
		expect(c.status).toBe("fail");
		expect(c.detail).toContain("invesst");
		expect(c.fix, "a failure has to say where to go").toBeTruthy();
	});

	it("CATCHES an authority row that no scope in code understands", async () => {
		await env.DB.prepare("INSERT INTO authority (scope, granted, detail) VALUES ('sudo', 1, 'not a real scope')").run();
		const c = check(await integrity(), "authority-drift");
		expect(c.status).toBe("fail");
		expect(c.detail).toContain("sudo");
	});

	it("CATCHES an orphaned row pointing at a deleted parent", async () => {
		await env.DB.prepare(
			"INSERT INTO trades (bot_id, strategy_id, symbol, side, qty, entry_price, opened_at_tick, outcome) VALUES (999999, 1, 'AETH', 'long', 1, 100, 1, 'open')",
		).run();
		const c = check(await integrity(), "no-orphan-rows");
		expect(c.status).toBe("fail");
		expect(c.detail).toContain("deleted bot");
	});

	it("CATCHES value created outside the ledger", async () => {
		// The one break that actually costs money: a balance written directly
		// instead of through transfer()/reward()/spend().
		await env.DB.prepare("UPDATE aether_accounts SET balance = balance + 5000 WHERE owner = 'creator'").run();
		const r = await integrity();
		expect(check(r, "aether-conserved").status).toBe("fail");
		expect(r.ok).toBe(false);
		expect(r.score).toBeLessThan(100);
	});

	it("a scan is chronicled — checks rows plus a report naming the break", async () => {
		await env.DB.prepare("INSERT INTO authority (scope, granted, detail) VALUES ('sudo', 1, 'rogue')").run();
		const res = await SELF.fetch("http://local.test/integrity/scan", { method: "POST" });
		expect(res.status).toBe(200);

		const rows = (await env.DB.prepare("SELECT name, status FROM checks WHERE name LIKE 'app:%'").all<{ name: string; status: string }>()).results;
		expect(rows.length).toBeGreaterThan(5);
		const report = await env.DB.prepare("SELECT title, body FROM reports WHERE kind = 'integrity' ORDER BY id DESC LIMIT 1").first<{ title: string; body: string }>();
		expect(report?.title).toContain("break");
		// The report must carry the remedy, not just the diagnosis.
		expect(report?.body).toContain("authority-drift");
		expect(report?.body).toContain("Scope union");
	});

	it("Lumi can run the self-check by voice or command bar", async () => {
		const res = await SELF.fetch("http://local.test/command", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ order: "run a self check" }),
		});
		const out = ((await res.json()) as any).result;
		expect(out.capability).toBe("integrity");
		expect(out.status).toBe("done");
		expect(out.result).toContain("structural integrity green");
	});

	it("watches on every pulse, and stays QUIET while nothing has drifted", async () => {
		// An automatic check that reports "still fine" every hour trains you to
		// ignore it. Three healthy pulses must produce no integrity report at all.
		for (let i = 0; i < 3; i++) {
			const res = await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" });
			const r = ((await res.json()) as any).result;
			expect(r.integrity.ok).toBe(true);
			expect(r.integrity.note).toContain("steady");
		}
		const reports = await env.DB.prepare("SELECT COUNT(*) as n FROM reports WHERE kind = 'integrity'").first<{ n: number }>();
		expect(reports?.n, "no report while healthy").toBe(0);
		// The history is still written, so a later investigation has something to read.
		const rows = await env.DB.prepare("SELECT COUNT(*) as n FROM checks WHERE name = 'app-integrity'").first<{ n: number }>();
		expect(rows?.n).toBe(3);
	});

	it("SPEAKS on the pulse when something has drifted, and keeps saying it", async () => {
		await env.DB.prepare("INSERT INTO authority (scope, granted, detail) VALUES ('sudo', 1, 'rogue')").run();
		for (let i = 0; i < 2; i++) {
			const res = await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" });
			const r = ((await res.json()) as any).result;
			expect(r.integrity.ok).toBe(false);
			expect(r.integrity.note).toContain("INTEGRITY BREAK");
			// The break appears in the pulse's own decision list, where Lumi
			// narrates what she did — not buried in a side table.
			expect(r.decisions.join(" ")).toContain("INTEGRITY BREAK");
		}
		// An unfixed break is restated every pulse; an all-clear is not.
		const reports = await env.DB.prepare("SELECT COUNT(*) as n FROM reports WHERE kind = 'integrity'").first<{ n: number }>();
		expect(reports?.n).toBe(2);
	});

	it("announces RECOVERY once, then goes quiet again", async () => {
		await env.DB.prepare("INSERT INTO authority (scope, granted, detail) VALUES ('sudo', 1, 'rogue')").run();
		await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" }); // breaks
		await env.DB.prepare("DELETE FROM authority WHERE scope = 'sudo'").run(); // fixed

		const fixed = ((await (await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" })).json()) as any).result;
		expect(fixed.integrity.ok).toBe(true);
		expect(fixed.integrity.changed, "the recovery is a state change").toBe(true);
		expect(fixed.integrity.note).toContain("recovered");

		const recovery = await env.DB.prepare("SELECT title FROM reports WHERE kind = 'integrity' ORDER BY id DESC LIMIT 1").first<{ title: string }>();
		expect(recovery?.title).toContain("recovered");

		// And it does not keep congratulating itself afterwards.
		const after = ((await (await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" })).json()) as any).result;
		expect(after.integrity.changed).toBe(false);
		const total = await env.DB.prepare("SELECT COUNT(*) as n FROM reports WHERE kind = 'integrity'").first<{ n: number }>();
		expect(total?.n, "one break report + one recovery report, nothing more").toBe(2);
	});

	it("rides along in the cockpit payload — no extra call to see it", async () => {
		const res = await SELF.fetch("http://local.test/analytics/overview");
		const d = ((await res.json()) as any).result;
		expect(d.integrity.ok).toBe(true);
		expect(d.integrity.checks.length).toBeGreaterThan(5);
	});
});
