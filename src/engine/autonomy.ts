// AUTONOMY — what Lumi does when nobody is watching.
//
// The `command` authority scope finally means something here. With it revoked
// (the default) a pulse does exactly what it always did: trade, learn, audit,
// sweep, quests. With it GRANTED, Lumi also reads her own situation at the end
// of each pulse and takes ONE corrective action on her own initiative.
//
// Deliberate design choices:
//   - One action per pulse, never a cascade. She fixes the most urgent thing
//     and reports; she does not spiral.
//   - She acts only within scopes already granted. Autonomy is permission to
//     USE her powers unattended, not a way to acquire new ones — an autonomous
//     step that needs `spend` still checks `spend`.
//   - Every autonomous act is logged as 'lumi-initiative' in the command log,
//     so an unattended decision is never invisible after the fact.

import { getAuthority } from "./command";
import { getRisk } from "./risk";
import { runSweep } from "./guardian";
import { auditInvest, recordAudit } from "./integrity";
import { runLearning } from "./learning";
import { auditApp, recordAppAudit } from "./appintegrity";
import { limitStatus } from "./ratelimit";
import { runScan } from "./shield";

export interface AutonomousAct {
	acted: boolean;
	reason: string;
	action: string;
	result: string;
}

async function granted(db: D1Database, scope: string): Promise<boolean> {
	const all = await getAuthority(db);
	return all.some((a) => a.scope === scope && a.granted);
}

// Read the situation and act on the single most urgent thing. Ordered by
// urgency: a failing house first, then drifting capital, then dull evidence.
export async function actOnInitiative(db: D1Database, env?: unknown): Promise<AutonomousAct> {
	const idle: AutonomousAct = { acted: false, reason: "", action: "", result: "" };

	if (!(await granted(db, "command"))) {
		return { ...idle, reason: "command scope not granted — Lumi acts only when asked" };
	}
	if (!(await granted(db, "operate"))) {
		return { ...idle, reason: "operate scope revoked — nothing to act with" };
	}

	// 1. A realm in alert is the loudest signal. Sweep the house.
	const alert = await db.prepare("SELECT key FROM realms WHERE status = 'alert' ORDER BY id LIMIT 1").first<{ key: string }>();
	if (alert) {
		const s = await runSweep(db);
		return await record(db, {
			acted: true,
			reason: `${alert.key} realm is in alert`,
			action: "guardian sweep",
			result: `sweep ${s.ok ? "clear" : "still FAILING"}`,
		});
	}

	// 2. Capital drawn down past the gate. Audit the ledger and file it.
	const risk = await getRisk(db);
	if (risk.halted) {
		const a = await auditInvest(db);
		await recordAudit(db, a);
		return await record(db, {
			acted: true,
			reason: "trading is halted by the risk gate",
			action: "invest audit",
			result: `audit ${a.ok ? "green — the ledger is sound, awaiting your resume" : "FAILED — do not resume yet"}`,
		});
	}

	// 3. A structural break — the code and the database disagree. This ranks
	// above capital work on purpose: when the wiring is wrong, every number the
	// next decision would rest on is suspect. She cannot fix code unattended,
	// so the honest act is to scan, record, and put it where you will see it.
	const broken = await db
		.prepare("SELECT status FROM checks WHERE name = 'app-integrity' ORDER BY id DESC LIMIT 1")
		.first<{ status: string }>();
	if (broken?.status === "fail") {
		const a = await auditApp(db, env);
		await recordAppAudit(db, a);
		const names = a.checks.filter((c) => c.status === "fail").map((c) => c.name);
		return await record(db, {
			acted: true,
			reason: "app integrity is failing — the code and the Databank disagree",
			action: "structural audit",
			result: a.ok
				? "the break cleared on re-check"
				: `still broken: ${names.join(", ")}. This needs a person — Lumi cannot edit her own code.`,
		});
	}

	// 4. Someone is attacking a door, or a door that should be locked isn't.
	// Either way the security panel should be freshly measured, not stale.
	const limits = await limitStatus(db);
	if (limits.lockedNow > 0) {
		const p = await runScan(db, env);
		return await record(db, {
			acted: true,
			reason: `${limits.lockedNow} bridge door is locked out right now — someone is guessing secrets`,
			action: "security scan",
			result: `posture ${p.score}/100 (${p.grade}). Rotate that bridge's secret if this was not you.`,
		});
	}

	// 5. Plenty of fresh evidence and no learning pass to show for it.
	//
	// This compared a TRADE id against a REPORT id — two unrelated sequences.
	// Reports accumulate far more slowly than trades, so the report id was
	// always tiny and almost every trade counted as "unexamined": she fired a
	// learning pass on essentially every pulse and called it initiative. The
	// comparison has to be against time, which is the thing actually meant.
	const [closed, lastLearn] = await Promise.all([
		db.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome != 'open'").first<{ n: number }>(),
		db.prepare("SELECT created_at FROM reports WHERE kind = 'learning' ORDER BY id DESC LIMIT 1").first<{ created_at: string }>(),
	]);
	const sinceLearn = await db
		.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome != 'open' AND created_at > ?")
		.bind(lastLearn?.created_at ?? "1970-01-01")
		.first<{ n: number }>();
	if ((closed?.n ?? 0) >= 20 && (sinceLearn?.n ?? 0) >= 20) {
		const l = await runLearning(db, { insight: 1 });
		return await record(db, {
			acted: true,
			reason: `${sinceLearn?.n ?? 0} closed trades of unexamined evidence`,
			action: "learning pass",
			result: `retired ${l.retired.length}, ${l.evolved ? "evolved the champion" : "no evolution warranted"}`,
		});
	}

	return { ...idle, reason: "nothing needed attention — the colony is steady" };
}

async function record(db: D1Database, act: AutonomousAct): Promise<AutonomousAct> {
	await db
		.prepare("INSERT INTO orchestrator_tasks (target, kind, directive, status, result) VALUES ('lumi-initiative', 'command', ?, 'done', ?)")
		.bind(`unattended: ${act.reason}`, `${act.action} → ${act.result}`)
		.run();
	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'initiative', ?, ?, ?, 'tech')")
		.bind(
			`Acted on her own: ${act.action}`,
			`Lumi saw that ${act.reason}, so she ran a ${act.action} unattended. Result: ${act.result}.`,
			JSON.stringify(act),
		)
		.run();
	return act;
}
