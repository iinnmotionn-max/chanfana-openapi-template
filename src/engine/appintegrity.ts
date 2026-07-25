// APP INTEGRITY — does this application still hold together?
//
// The Invest audit (integrity.ts) proves the trading ledger reconciles. The
// Guardian sweep proves the system is alive. Neither answers a different and
// nastier question: **has the code drifted away from the database it runs on?**
//
// That drift is how a project this size rots. A capability is added and its
// trigger word is silently shadowed by an older one, so the command never
// routes. A scope is added to a TypeScript union but never to the authority
// table, so the grant can never be given. A realm key is typo'd in one INSERT,
// so those reports vanish from the cockpit with no error anywhere. Every one of
// those ships green: tests pass, nothing throws, and a feature is simply dead.
//
// So these checks read the code's own declarations — the capability registry,
// the Scope union, the realm keys — and hold them against what the Databank
// actually contains. A check fails here when the two disagree, which is the
// only moment that kind of bug is cheap to fix.
//
// Every finding names the file to open. An integrity report you can't act on
// is just anxiety.

import { CAPABILITIES, route, type Scope } from "./command";
import { auditSupply } from "./token";

export interface AppCheck {
	name: string;
	area: "schema" | "wiring" | "referential" | "value" | "config";
	status: "pass" | "warn" | "fail";
	detail: string;
	fix?: string; // where to go when it fails
}

export interface AppIntegrity {
	ok: boolean;
	score: number; // 0..100
	checks: AppCheck[];
	counts: { pass: number; warn: number; fail: number };
}

// The scopes the code knows about. Kept beside the Scope union deliberately:
// if someone widens the union and forgets this list, the drift check below is
// what tells them — and if they update both but skip the migration, the
// database comparison catches it.
const CODE_SCOPES: Scope[] = ["observe", "operate", "spend", "publish", "command", "machine"];

// Tables the running code reads or writes. A missing one means a migration
// never landed on this database.
const REQUIRED_TABLES = [
	"agents", "strategies", "bots", "trades", "reports", "goals", "market_state",
	"realms", "checks", "wellness_checkins", "quests", "metrics", "lumi_state",
	"knowledge", "auras", "live_ticks", "risk_config", "aether_accounts",
	"aether_ledger", "shield_findings", "pools", "vaults", "loans", "lp_positions",
	"defi_events", "posts", "campaigns", "leads", "connectors", "deals",
	"kyc_attestations", "orchestrator_tasks", "authority", "local_tasks",
	"rate_limits", "rotation_events",
];

async function tableNames(db: D1Database): Promise<Set<string>> {
	const rows = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()).results;
	return new Set(rows.map((r) => r.name));
}

async function count(db: D1Database, sql: string): Promise<number> {
	const row = await db.prepare(sql).first<{ n: number }>();
	return row?.n ?? 0;
}

export async function auditApp(db: D1Database, env: unknown): Promise<AppIntegrity> {
	const checks: AppCheck[] = [];
	const tables = await tableNames(db);

	// --- SCHEMA: is every table the code depends on actually here? ---
	const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
	checks.push(
		missing.length > 0
			? {
					name: "schema-complete",
					area: "schema",
					status: "fail",
					detail: `${missing.length} table(s) the code uses do not exist: ${missing.join(", ")}`,
					fix: "A migration never applied. Run: npx wrangler d1 migrations apply DB --local",
				}
			: { name: "schema-complete", area: "schema", status: "pass", detail: `all ${REQUIRED_TABLES.length} tables the code depends on are present` },
	);

	// --- WIRING: every capability must route back to itself ---
	// The router picks the LONGEST matching trigger, so a new capability whose
	// trigger is a substring of an older, longer one is silently unreachable.
	// Nothing else in the system would ever notice: no error, no failing test,
	// just a command that quietly does something else.
	const shadowed: string[] = [];
	for (const cap of CAPABILITIES) {
		for (const trigger of cap.triggers) {
			const landed = route(trigger);
			if (landed?.id !== cap.id) shadowed.push(`"${trigger}" (${cap.id}) → ${landed ? landed.id : "nothing"}`);
		}
	}
	checks.push(
		shadowed.length > 0
			? {
					name: "capability-routing",
					area: "wiring",
					status: "fail",
					detail: `${shadowed.length} trigger(s) do not reach their own capability: ${shadowed.join("; ")}`,
					fix: "src/engine/command.ts — a longer trigger elsewhere is shadowing these. Make the trigger more specific.",
				}
			: {
					name: "capability-routing",
					area: "wiring",
					status: "pass",
					detail: `all ${CAPABILITIES.reduce((n, c) => n + c.triggers.length, 0)} triggers across ${CAPABILITIES.length} capabilities route to their own capability`,
				},
	);

	// --- WIRING: the Scope union vs the authority ledger ---
	// A scope in code with no row can never be granted, so the capability behind
	// it is dead. A row with no scope in code is a grant that authorizes nothing.
	if (tables.has("authority")) {
		const rows = (await db.prepare("SELECT scope FROM authority").all<{ scope: string }>()).results.map((r) => r.scope);
		const ungrantable = CODE_SCOPES.filter((s) => !rows.includes(s));
		const orphanGrants = rows.filter((s) => !CODE_SCOPES.includes(s as Scope));
		checks.push(
			ungrantable.length > 0 || orphanGrants.length > 0
				? {
						name: "authority-drift",
						area: "wiring",
						status: "fail",
						detail: [
							ungrantable.length > 0 ? `scope(s) in code with no row to grant: ${ungrantable.join(", ")}` : "",
							orphanGrants.length > 0 ? `row(s) with no scope in code: ${orphanGrants.join(", ")}` : "",
						]
							.filter(Boolean)
							.join(" — "),
						fix: "src/engine/command.ts (Scope union) and migrations/ (INSERT INTO authority) must agree.",
					}
				: { name: "authority-drift", area: "wiring", status: "pass", detail: `${rows.length} scopes; the Scope union and the authority ledger agree exactly` },
		);

		// Every capability's scope must exist, or that capability can never run.
		const capScopes = [...new Set(CAPABILITIES.map((c) => c.scope))];
		const unreachable = capScopes.filter((s) => !rows.includes(s));
		checks.push(
			unreachable.length > 0
				? {
						name: "capability-authority",
						area: "wiring",
						status: "fail",
						detail: `capabilities gated behind ungrantable scope(s): ${unreachable.join(", ")}`,
						fix: "Add the scope to the authority table in a migration.",
					}
				: { name: "capability-authority", area: "wiring", status: "pass", detail: `every capability's scope (${capScopes.join(", ")}) is grantable` },
		);
	}

	// --- WIRING: realm keys the cockpit can actually render ---
	// The cockpit renders one panel per row in `realms`. A report or check filed
	// under any other key is written, stored, and never seen by anyone — the
	// most invisible bug in the system, because nothing errors.
	//
	// The realms table is the authority here, not a list in this file. This
	// check earned that design immediately: written against a hardcoded list, it
	// failed on the first real database, and the list was what was wrong.
	const knownRealms = new Set(
		tables.has("realms") ? (await db.prepare("SELECT key FROM realms").all<{ key: string }>()).results.map((r) => r.key) : [],
	);
	const usedRealms = new Set<string>();
	if (tables.has("reports")) {
		for (const r of (await db.prepare("SELECT DISTINCT realm FROM reports WHERE realm IS NOT NULL").all<{ realm: string }>()).results) usedRealms.add(r.realm);
	}
	if (tables.has("checks")) {
		for (const r of (await db.prepare("SELECT DISTINCT realm FROM checks WHERE realm IS NOT NULL").all<{ realm: string }>()).results) usedRealms.add(r.realm);
	}
	const strayRealms = [...usedRealms].filter((r) => r && !knownRealms.has(r));
	checks.push(
		strayRealms.length > 0
			? {
					name: "realm-keys",
					area: "wiring",
					status: "fail",
					detail: `content filed under realm key(s) with no realm row, invisible in the cockpit: ${strayRealms.join(", ")} (known: ${[...knownRealms].join(", ")})`,
					fix: "Fix the realm string at the INSERT site, or add the realm in a migration.",
				}
			: { name: "realm-keys", area: "wiring", status: "pass", detail: `all ${usedRealms.size} realm key(s) in use match a realm the cockpit renders` },
	);

	// --- REFERENTIAL: orphaned rows point at things that no longer exist ---
	const orphans: string[] = [];
	if (tables.has("trades") && tables.has("bots")) {
		const n = await count(db, "SELECT COUNT(*) as n FROM trades WHERE bot_id NOT IN (SELECT id FROM bots)");
		if (n > 0) orphans.push(`${n} trade(s) on a deleted bot`);
	}
	if (tables.has("bots") && tables.has("strategies")) {
		const n = await count(db, "SELECT COUNT(*) as n FROM bots WHERE strategy_id NOT IN (SELECT id FROM strategies)");
		if (n > 0) orphans.push(`${n} bot(s) running a deleted strategy`);
	}
	if (tables.has("aether_ledger") && tables.has("aether_accounts")) {
		// 'genesis' is the one legitimate non-account counterparty: the origin of
		// the fixed supply, which by construction has no balance to hold.
		const n = await count(
			db,
			`SELECT COUNT(*) as n FROM aether_ledger
			 WHERE (from_owner NOT IN ('', 'genesis') AND from_owner NOT IN (SELECT owner FROM aether_accounts))
			    OR (to_owner NOT IN ('', 'genesis') AND to_owner NOT IN (SELECT owner FROM aether_accounts))`,
		);
		if (n > 0) orphans.push(`${n} ledger entr(ies) referencing a missing account`);
	}
	checks.push(
		orphans.length > 0
			? { name: "no-orphan-rows", area: "referential", status: "fail", detail: orphans.join("; "), fix: "Something deleted a parent row without its children. Check the delete path." }
			: { name: "no-orphan-rows", area: "referential", status: "pass", detail: "trades, bots, and ledger entries all point at rows that exist" },
	);

	// --- VALUE: AETHER is conserved and nothing is negative ---
	const supply = await auditSupply(db);
	checks.push({
		name: "aether-conserved",
		area: "value",
		status: supply.status === "pass" ? "pass" : "fail",
		detail: supply.detail,
		fix: supply.status === "pass" ? undefined : "Value was created or destroyed outside transfer()/reward()/spend(). Find the write that bypassed the ledger.",
	});

	const negatives: string[] = [];
	if (tables.has("aether_accounts")) {
		const n = await count(db, "SELECT COUNT(*) as n FROM aether_accounts WHERE balance < 0");
		if (n > 0) negatives.push(`${n} AETHER account(s) below zero`);
	}
	if (tables.has("bots")) {
		const n = await count(db, "SELECT COUNT(*) as n FROM bots WHERE balance < 0");
		if (n > 0) negatives.push(`${n} bot(s) with negative balance`);
	}
	checks.push(
		negatives.length > 0
			? { name: "no-negative-balances", area: "value", status: "fail", detail: negatives.join("; "), fix: "A debit path is missing its sufficiency check." }
			: { name: "no-negative-balances", area: "value", status: "pass", detail: "no account or bot holds a negative balance" },
	);

	// --- CONFIG: a bridge whose secret is set but which nothing has ever used ---
	// Not a failure — you may have just configured it. But an inbound door that
	// has never been walked through is attack surface earning nothing, and worth
	// seeing rather than forgetting.
	const readEnv = (k: string) => {
		const v = (env as Record<string, unknown> | null | undefined)?.[k];
		return typeof v === "string" ? v : "";
	};
	const idleBridges: string[] = [];
	if (readEnv("RP_SHARED_SECRET") && tables.has("checks")) {
		const n = await count(db, "SELECT COUNT(*) as n FROM checks WHERE name = 'rp-bridge'");
		if (n === 0) idleBridges.push("Roblox city (RP_SHARED_SECRET set, no call has ever arrived)");
	}
	if (readEnv("LOCAL_AGENT_SECRET") && tables.has("local_tasks")) {
		const n = await count(db, "SELECT COUNT(*) as n FROM local_tasks WHERE status != 'queued'");
		if (n === 0) idleBridges.push("local agent (LOCAL_AGENT_SECRET set, no task has ever been claimed)");
	}
	checks.push(
		idleBridges.length > 0
			? {
					name: "bridges-in-use",
					area: "config",
					status: "warn",
					detail: `open but unused: ${idleBridges.join("; ")}`,
					fix: "If you're not using it yet, that's fine. If you're done with it, unset the secret — an unused door is still a door.",
				}
			: { name: "bridges-in-use", area: "config", status: "pass", detail: "no inbound bridge is enabled-but-unused" },
	);

	const pass = checks.filter((c) => c.status === "pass").length;
	const warn = checks.filter((c) => c.status === "warn").length;
	const fail = checks.filter((c) => c.status === "fail").length;
	// A warn costs half a check; a fail costs the whole thing.
	const score = Math.round(((pass + warn * 0.5) / checks.length) * 100);

	return { ok: fail === 0, score, checks, counts: { pass, warn, fail } };
}

// The unattended watch. Runs on every pulse (hourly on the cron), so drift is
// caught by the system rather than by whoever happens to open the cockpit.
//
// The hard part of an automatic check is not detecting the break — it's not
// becoming noise. A report every hour saying "still fine" trains you to ignore
// the one that says otherwise. So this speaks on CHANGE:
//
//   green  → broken   file the break, with the remedy
//   broken → green    say it recovered, so a fixed problem visibly closes
//   green  → green    one summary row, no report, silence
//
// The summary row is always written, so there is still an hour-by-hour history
// to look back through when something did go wrong.
export interface IntegrityWatch {
	score: number;
	ok: boolean;
	changed: boolean;
	was: "pass" | "fail" | null; // null = first ever run
	note: string;
}

export async function watchIntegrity(db: D1Database, env: unknown): Promise<IntegrityWatch> {
	const audit = await auditApp(db, env);
	const now: "pass" | "fail" = audit.ok ? "pass" : "fail";

	const prev = await db
		.prepare("SELECT status FROM checks WHERE name = 'app-integrity' ORDER BY id DESC LIMIT 1")
		.first<{ status: string }>();
	const was = prev ? ((prev.status === "pass" ? "pass" : "fail") as "pass" | "fail") : null;
	const changed = was !== null && was !== now;
	const broken = audit.checks.filter((c) => c.status === "fail");

	await db
		.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('guardian', 'app-integrity', ?, ?)")
		.bind(now, `${audit.score}/100 — ${audit.counts.pass} pass, ${audit.counts.warn} warn, ${audit.counts.fail} fail`)
		.run();

	// Every failing pulse re-states the break — including the very first run,
	// which has no earlier state to have "changed" from. An unfixed structural
	// break is worth repeating; an all-clear is not.
	if (!audit.ok) {
		await recordAppAudit(db, audit);
		return { score: audit.score, ok: false, changed, was, note: `INTEGRITY BREAK — ${broken.map((c) => c.name).join(", ")}` };
	}

	if (changed) {
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('guardian', 'integrity', ?, ?, ?, 'guardian')")
			.bind(
				`App integrity recovered — ${audit.score}/100`,
				"The structural break is gone; the code and the Databank agree again.",
				JSON.stringify(audit),
			)
			.run();
		return { score: audit.score, ok: true, changed, was, note: "integrity recovered" };
	}

	return { score: audit.score, ok: true, changed: false, was, note: `integrity steady at ${audit.score}/100` };
}

// Record an app-integrity audit into the Databank so drift is chronicled over
// time, not just observed once. Failures raise a report the creator will see.
export async function recordAppAudit(db: D1Database, audit: AppIntegrity): Promise<void> {
	const statements = audit.checks.map((c) =>
		db.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('guardian', ?, ?, ?)").bind(`app:${c.name}`, c.status, c.detail),
	);
	const broken = audit.checks.filter((c) => c.status === "fail");
	statements.push(
		db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('guardian', 'integrity', ?, ?, ?, 'guardian')")
			.bind(
				audit.ok ? `App integrity green (${audit.score}/100)` : `App integrity: ${broken.length} break(s) found`,
				audit.ok
					? `${audit.checks.length} structural checks pass — the code and the Databank agree.`
					: broken.map((c) => `${c.name}: ${c.detail}${c.fix ? ` — ${c.fix}` : ""}`).join("\n"),
				JSON.stringify(audit),
			),
	);
	await db.batch(statements);
}
