import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Lumi's automation is a Cron Trigger firing hourly. The failure mode is
// silent: a stopped cron looks exactly like a healthy one — the cockpit keeps
// rendering the last numbers it has, every realm still says nominal, and
// nothing says "this is from Tuesday". These tests are about making that gap
// impossible to miss, and about NOT crying wolf when nothing is wrong.

const CREATOR_KEY = "test-creator-key";

async function overview() {
	return ((await (await SELF.fetch("http://local.test/analytics/overview")).json()) as any).result;
}
async function pulse(qs = "") {
	return ((await (await SELF.fetch(`http://local.test/lumi/pulse${qs}`, { method: "POST" })).json()) as any).result;
}
// Backdate the newest cron run to simulate time passing, since tests cannot wait.
async function ageCron(minutes: number) {
	await env.DB.prepare(
		"UPDATE automation_runs SET created_at = datetime('now', ?) WHERE id = (SELECT MAX(id) FROM automation_runs WHERE source = 'cron')",
	)
		.bind(`-${minutes} minutes`)
		.run();
}
async function cronRun() {
	await env.DB.prepare("INSERT INTO automation_runs (kind, source, ok, detail) VALUES ('pulse','cron',1,'scheduled')").run();
}

describe("Automation health — proving the unattended work is happening", () => {
	it("says NOT YET RUN rather than crying failure on a fresh system", async () => {
		// A system that has never pulsed is new, not broken. Telling someone
		// their automation failed when they simply haven't deployed is how a
		// health check gets ignored forever after.
		const a = (await overview()).automation;
		expect(a.verdict).toBe("never");
		expect(a.label).toBe("NOT YET RUN");
		expect(a.detail).toContain("does not run crons");
		expect(a.lastCronAt).toBeNull();
	});

	it("a pulse fired BY HAND does not make a dead schedule look alive", async () => {
		// This is the trap: click Pulse in the cockpit and a naive health check
		// goes green while the cron is still dead.
		await pulse();
		await pulse("?source=autopilot");
		const a = (await overview()).automation;
		expect(a.runs24h, "the manual runs are recorded").toBeGreaterThanOrEqual(2);
		expect(a.verdict, "but they prove nothing about the schedule").toBe("never");
	});

	it("reads healthy once a real cron run lands", async () => {
		await cronRun();
		const a = (await overview()).automation;
		expect(a.verdict).toBe("healthy");
		expect(a.label).toBe("RUNNING");
		expect(a.minutesSinceCron).toBeLessThan(5);
	});

	it("escalates LATE then STALLED as the gap grows", async () => {
		await cronRun();
		await ageCron(100); // past 1.5x the hourly schedule (90m)
		let a = (await overview()).automation;
		expect(a.verdict).toBe("late");
		// One late run is not a fault — the message must say so, or it reads as
		// an outage every time Cloudflare is a few minutes behind.
		expect(a.detail).toContain("best-effort");

		await ageCron(400); // past 3x
		a = (await overview()).automation;
		expect(a.verdict).toBe("stalled");
		expect(a.label).toBe("STALLED");
		expect(a.detail).toContain("Cron Triggers");
		// The consequence stated plainly: the screen is as old as the gap.
		expect(a.detail).toContain("as old as that gap");
	});

	it("counts failures, so a cron that fires but throws is not called healthy", async () => {
		await env.DB.prepare("INSERT INTO automation_runs (kind, source, ok, detail) VALUES ('pulse','cron',0,'pulse threw: boom')").run();
		const a = (await overview()).automation;
		expect(a.failures24h).toBeGreaterThan(0);
		expect(a.recent[0].ok).toBe(false);
		expect(a.recent[0].detail).toContain("boom");
	});

	it("the panel badge distinguishes a live schedule from a dev machine", async () => {
		const s = Object.fromEntries((await overview()).sources.map((x: any) => [x.panel, x]));
		expect(s.automation.label).toBe("NOT DEPLOYED");
		await cronRun();
		const s2 = Object.fromEntries((await overview()).sources.map((x: any) => [x.panel, x]));
		expect(s2.automation.label).toBe("CRON LIVE");
	});

	it("every manual pulse returns its own automation read-out", async () => {
		const r = await pulse();
		expect(r.automation.verdict).toBeTruthy();
		expect(r.automation.expectedEveryMinutes).toBe(60);
	});
});

describe("Autonomy — what she acts on, unattended", () => {
	async function grantCommand() {
		await SELF.fetch("http://local.test/command/authority", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
			body: JSON.stringify({ scope: "command", granted: true }),
		});
	}

	it("treats a STRUCTURAL break as more urgent than capital work", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		await grantCommand();
		// A rogue authority row breaks app integrity; record that state first.
		await env.DB.prepare("INSERT INTO authority (scope, granted, detail) VALUES ('sudo', 1, 'rogue')").run();
		await SELF.fetch("http://local.test/integrity/scan", { method: "POST" });
		await env.DB.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('guardian','app-integrity','fail','broken')").run();

		const r = await pulse();
		expect(r.autonomous.acted).toBe(true);
		expect(r.autonomous.action).toBe("structural audit");
		// And she says plainly that this one is not hers to fix.
		expect(r.autonomous.result).toContain("needs a person");
	});

	it("acts on a live lockout — someone guessing secrets is worth a fresh scan", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		await grantCommand();
		for (let i = 0; i < 8; i++) {
			await SELF.fetch("http://local.test/rp/grant", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: 1, amount: 1, secret: `guess-${i}` }),
			});
		}
		const r = await pulse();
		expect(r.autonomous.acted).toBe(true);
		expect(r.autonomous.action).toBe("security scan");
		expect(r.autonomous.reason).toContain("guessing secrets");
	});

	it("still stands down when nothing needs attention", async () => {
		// The pulse itself trades AND learns, so by the time autonomy runs there
		// is no unexamined evidence left. Before the id-vs-timestamp fix she
		// fired a learning pass here every single pulse and called it initiative.
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		await grantCommand();
		const r = await pulse();
		expect(r.autonomous.acted, `acted anyway: ${r.autonomous.action} — ${r.autonomous.reason}`).toBe(false);
		expect(r.autonomous.reason).toContain("steady");
	});
});
