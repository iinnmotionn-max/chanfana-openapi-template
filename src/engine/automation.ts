// IS THE AUTOMATION ACTUALLY RUNNING?
//
// Lumi pulses hourly on a Cron Trigger: trade, learn, audit, sweep, scout,
// check her own structure, and — with the `command` grant — take one corrective
// action unattended. All of that is worth having only if it is actually
// happening, and the failure mode is silent.
//
// A stopped cron looks exactly like a healthy one. The cockpit keeps rendering
// the last numbers it has, every realm still says nominal, and nothing says
// "this is from Tuesday". You would find out when a decision you made on those
// numbers turned out to be based on week-old state.
//
// This module makes the gap measurable and names it. Three honest distinctions
// it refuses to blur:
//
//   * "never run" is not "stalled". A system that has never pulsed isn't
//     broken, it's new — and telling someone their automation failed when they
//     simply haven't deployed yet is how a health check gets ignored.
//   * A pulse fired BY HAND is not evidence the cron works. Only cron-sourced
//     runs count toward automation health; otherwise clicking Pulse in the
//     cockpit would paper over a dead trigger.
//   * Cron cadence is hourly, so lateness is only meaningful past a real
//     margin. Cloudflare does not promise the second, and an alarm that cries
//     wolf at 61 minutes trains you to ignore it.

export type AutomationVerdict = "healthy" | "late" | "stalled" | "never";

export interface AutomationHealth {
	verdict: AutomationVerdict;
	label: string;
	detail: string;
	lastCronAt: string | null;
	minutesSinceCron: number | null;
	expectedEveryMinutes: number;
	runs24h: number;
	failures24h: number;
	recent: { kind: string; source: string; ok: boolean; detail: string; at: string; ms: number }[];
}

// The cron is hourly (wrangler.jsonc: "0 * * * *"). Cloudflare schedules are
// best-effort, so "late" starts at 1.5x and "stalled" at 3x — wide enough that
// an alarm means something, tight enough to notice within a morning.
const EXPECTED_MINUTES = 60;
const LATE_AFTER = EXPECTED_MINUTES * 1.5;
const STALLED_AFTER = EXPECTED_MINUTES * 3;

export async function recordRun(
	db: D1Database,
	kind: string,
	source: string,
	ok: boolean,
	detail: string,
	durationMs: number,
): Promise<void> {
	await db
		.prepare("INSERT INTO automation_runs (kind, source, ok, detail, duration_ms) VALUES (?, ?, ?, ?, ?)")
		.bind(kind, source, ok ? 1 : 0, detail.slice(0, 400), Math.round(durationMs))
		.run();
}

export async function automationHealth(db: D1Database): Promise<AutomationHealth> {
	const [lastCron, day, recent] = await Promise.all([
		// Only cron runs count. A hand-fired pulse proves a human was present,
		// not that the schedule is alive.
		db
			.prepare("SELECT created_at, (julianday('now') - julianday(created_at)) * 1440 AS mins FROM automation_runs WHERE source = 'cron' ORDER BY id DESC LIMIT 1")
			.first<{ created_at: string; mins: number }>(),
		db
			.prepare("SELECT COUNT(*) as n, SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) as bad FROM automation_runs WHERE created_at > datetime('now', '-1 day')")
			.first<{ n: number; bad: number }>(),
		db
			.prepare("SELECT kind, source, ok, detail, created_at, duration_ms FROM automation_runs ORDER BY id DESC LIMIT 8")
			.all<{ kind: string; source: string; ok: number; detail: string; created_at: string; duration_ms: number }>(),
	]);

	const mins = lastCron ? Math.max(0, Math.round(lastCron.mins)) : null;
	let verdict: AutomationVerdict;
	let label: string;
	let detail: string;

	if (mins === null) {
		verdict = "never";
		label = "NOT YET RUN";
		detail =
			"The hourly Cron Trigger has never fired here. That is expected until the Worker is deployed — `wrangler dev` does not run crons. Nothing is broken; nothing is automatic yet either.";
	} else if (mins <= LATE_AFTER) {
		verdict = "healthy";
		label = "RUNNING";
		detail = `Last unattended pulse ${mins} minute(s) ago. The hourly trigger is firing.`;
	} else if (mins <= STALLED_AFTER) {
		verdict = "late";
		label = "LATE";
		detail = `${mins} minutes since the last cron pulse, against an hourly schedule. Cloudflare crons are best-effort, so one late run is not a fault — two in a row is.`;
	} else {
		verdict = "stalled";
		label = "STALLED";
		detail = `${mins} minutes since the last cron pulse — more than 3 hours of an hourly schedule. Check the Worker's Cron Triggers in the Cloudflare dashboard. Everything on screen is as old as that gap.`;
	}

	return {
		verdict,
		label,
		detail,
		lastCronAt: lastCron?.created_at ?? null,
		minutesSinceCron: mins,
		expectedEveryMinutes: EXPECTED_MINUTES,
		runs24h: day?.n ?? 0,
		failures24h: day?.bad ?? 0,
		recent: (recent.results ?? []).map((r) => ({
			kind: r.kind,
			source: r.source,
			ok: r.ok === 1,
			detail: r.detail,
			at: r.created_at,
			ms: r.duration_ms,
		})),
	};
}
