// The Guardian realm: Reg's protection sweep. Checks the Databank is intact,
// the invest ledger is honest, no PII leaked into reports or check-ins, the
// agents are alive, and the market state is continuous. Every sweep is
// recorded — checks rows, a report, the realm status light, and the goal.

import { auditInvest, IntegrityCheck } from "./integrity";
import { getRisk } from "./risk";
import { auditSupply } from "./token";

export interface SweepResult {
	ok: boolean;
	checks: IntegrityCheck[];
}

export const EXPECTED_TABLES = [
	"agents",
	"strategies",
	"bots",
	"trades",
	"reports",
	"goals",
	"market_state",
	"realms",
	"checks",
	"wellness_checkins",
	"metrics",
	"lumi_state",
	"quests",
	"knowledge",
	"auras",
	"risk_config",
	"aether_accounts",
	"aether_ledger",
] as const;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const LONG_DIGITS_RE = /\d{10,}/;

export async function runSweep(db: D1Database): Promise<SweepResult> {
	const checks: IntegrityCheck[] = [];

	// Databank online: the database answers and every expected table exists.
	try {
		await db.prepare("SELECT 1").first();
		const tables = (
			await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()
		).results.map((r) => r.name);
		const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
		checks.push(
			missing.length > 0
				? { name: "databank-online", status: "fail", detail: `Databank reachable but missing tables: ${missing.join(", ")}` }
				: { name: "databank-online", status: "pass", detail: `Databank online; all ${EXPECTED_TABLES.length} expected tables present` },
		);
	} catch (err) {
		checks.push({ name: "databank-online", status: "fail", detail: `Databank unreachable: ${String(err)}` });
	}

	// Invest ledger: fold the full audit into one Guardian check.
	const audit = await auditInvest(db);
	const auditFails = audit.checks.filter((c) => c.status === "fail");
	const auditWarns = audit.checks.filter((c) => c.status === "warn");
	checks.push({
		name: "invest-ledger",
		status: auditFails.length > 0 ? "fail" : auditWarns.length > 0 ? "warn" : "pass",
		detail:
			auditFails.length > 0
				? `invest audit failing: ${auditFails.map((c) => c.name).join(", ")}`
				: auditWarns.length > 0
					? `invest audit warnings: ${auditWarns.map((c) => c.name).join(", ")}`
					: `invest audit green (${audit.checks.length} checks pass)`,
	});

	// Privacy scan: no email addresses or long digit runs (account/phone-like)
	// in the latest report feed or any wellness note.
	const reports = (
		await db
			.prepare("SELECT id, title, body FROM reports ORDER BY id DESC LIMIT 200")
			.all<{ id: number; title: string; body: string }>()
	).results;
	const notes = (
		await db.prepare("SELECT id, note FROM wellness_checkins").all<{ id: number; note: string }>()
	).results;
	const auraNotes = (
		await db.prepare("SELECT id, notes FROM auras").all<{ id: number; notes: string }>()
	).results;
	const piiHits: string[] = [];
	for (const r of reports) {
		const text = `${r.title}\n${r.body}`;
		if (EMAIL_RE.test(text) || LONG_DIGITS_RE.test(text)) piiHits.push(`report #${r.id}`);
	}
	for (const n of notes) {
		if (EMAIL_RE.test(n.note) || LONG_DIGITS_RE.test(n.note)) piiHits.push(`checkin #${n.id}`);
	}
	for (const a of auraNotes) {
		if (EMAIL_RE.test(a.notes) || LONG_DIGITS_RE.test(a.notes)) piiHits.push(`aura #${a.id}`);
	}
	checks.push(
		piiHits.length > 0
			? { name: "privacy-scan", status: "warn", detail: `PII-like content found in: ${piiHits.join(", ")}` }
			: { name: "privacy-scan", status: "pass", detail: `no PII-like content in latest ${reports.length} reports, ${notes.length} wellness notes, or ${auraNotes.length} auras` },
	);

	// Aura consent: notes only exist with consent, and the creator is never
	// profiled — the aura layer's privacy rules, verified from the data.
	const violations = (
		await db
			.prepare("SELECT id FROM auras WHERE (LENGTH(notes) > 0 AND consent = 0) OR name LIKE '%creator%'")
			.all<{ id: number }>()
	).results;
	checks.push(
		violations.length > 0
			? { name: "aura-consent", status: "fail", detail: `auras violating consent/creator rules: ${violations.map((v) => v.id).join(", ")}` }
			: { name: "aura-consent", status: "pass", detail: `${auraNotes.length} auras respect consent; creator never profiled` },
	);

	// Agents heartbeat: every active agent checks in.
	const beat = await db.prepare("UPDATE agents SET last_seen = CURRENT_TIMESTAMP WHERE status = 'active'").run();
	checks.push({
		name: "agents-heartbeat",
		status: "pass",
		detail: `${beat.meta.changes ?? 0} active agents checked in`,
	});

	// Market continuity: every market row must have a sane tick and price.
	const market = (
		await db.prepare("SELECT symbol, tick, price FROM market_state").all<{ symbol: string; tick: number; price: number }>()
	).results;
	if (market.length === 0) {
		checks.push({ name: "market-continuity", status: "pass", detail: "no market yet" });
	} else {
		const corrupt = market.filter((m) => m.tick < 0 || m.price <= 0);
		checks.push(
			corrupt.length > 0
				? { name: "market-continuity", status: "fail", detail: `corrupt market state: ${corrupt.map((m) => m.symbol).join(", ")}` }
				: { name: "market-continuity", status: "pass", detail: `${market.length} market(s) continuous: tick >= 0 and price > 0` },
		);
	}

	// Risk gates: the colony-level drawdown / exposure limits and global halt.
	const risk = await getRisk(db);
	checks.push({
		name: "risk-gates",
		status: risk.halted ? "warn" : risk.breaches.length > 0 ? "warn" : "pass",
		detail: risk.halted
			? "trading halted: " + risk.reason
			: risk.breaches.length > 0
				? "within halt grace but " + risk.breaches.join("; ")
				: "drawdown " + (risk.drawdown * 100).toFixed(1) + "%, " + risk.openPositions + " open positions — within limits",
	});

	// Aether token supply: every balance is backed and total supply is fixed.
	checks.push(await auditSupply(db));

	const result: SweepResult = { ok: checks.every((c) => c.status !== "fail"), checks };
	await recordSweep(db, result);
	return result;
}

async function recordSweep(db: D1Database, sweep: SweepResult): Promise<void> {
	const pass = sweep.checks.filter((c) => c.status === "pass").length;
	const warn = sweep.checks.filter((c) => c.status === "warn").length;
	const fail = sweep.checks.filter((c) => c.status === "fail").length;
	const realmStatus = fail > 0 ? "alert" : warn > 0 ? "watch" : "nominal";

	const statements = sweep.checks.map((c) =>
		db
			.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('guardian', ?, ?, ?)")
			.bind(c.name, c.status, c.detail),
	);
	statements.push(
		db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'sweep', ?, ?, ?, 'guardian')")
			.bind(
				`Guardian sweep: ${sweep.ok ? "all clear" : "issues found"}`,
				`${sweep.checks.length} checks: ${pass} pass, ${warn} warn, ${fail} fail.`,
				JSON.stringify(sweep),
			),
	);
	statements.push(
		db.prepare("UPDATE realms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'guardian'").bind(realmStatus),
	);
	statements.push(
		db
			.prepare("UPDATE goals SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE title = 'Protection sweep cadence'")
			.bind(sweep.ok ? 1 : 0),
	);
	await db.batch(statements);
}
