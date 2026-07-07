// The Invest realm's ledger audit: every number is recomputed from the raw
// trade evidence in the Databank. No theater — a check passes only because
// the data says so.

export interface IntegrityCheck {
	name: string;
	status: "pass" | "warn" | "fail";
	detail: string;
}

export interface AuditResult {
	ok: boolean;
	checks: IntegrityCheck[];
}

export async function auditInvest(db: D1Database): Promise<AuditResult> {
	const checks: IntegrityCheck[] = [];

	// Ledger reconciliation: for every bot, starting_balance + closed PnL must
	// equal the recorded balance (to the cent).
	const ledger = (
		await db
			.prepare(
				`SELECT b.name, b.balance, b.starting_balance,
				        COALESCE(SUM(CASE WHEN t.outcome != 'open' THEN t.pnl ELSE 0 END), 0) as closedPnl
				 FROM bots b LEFT JOIN trades t ON t.bot_id = b.id
				 GROUP BY b.id`,
			)
			.all<{ name: string; balance: number; starting_balance: number; closedPnl: number }>()
	).results;
	const unreconciled = ledger.filter((b) => Math.abs(b.starting_balance + b.closedPnl - b.balance) > 0.01);
	checks.push(
		unreconciled.length > 0
			? {
					name: "ledger-reconciliation",
					status: "fail",
					detail: `${unreconciled.length} of ${ledger.length} bots do not reconcile: ${unreconciled.map((b) => b.name).join(", ")}`,
				}
			: {
					name: "ledger-reconciliation",
					status: "pass",
					detail: `${ledger.length} bots reconcile: starting balance + closed PnL = balance (within 0.01)`,
				},
	);

	// Trade validity: no trade with nonsense quantities/prices, no closed trade
	// missing its exit price or PnL.
	const invalid = await db
		.prepare(
			`SELECT COUNT(*) as n FROM trades
			 WHERE qty <= 0 OR entry_price <= 0
			    OR (outcome != 'open' AND (exit_price IS NULL OR pnl IS NULL))`,
		)
		.first<{ n: number }>();
	const invalidCount = invalid?.n ?? 0;
	checks.push(
		invalidCount > 0
			? { name: "trade-validity", status: "fail", detail: `${invalidCount} invalid trades (qty/entry <= 0 or closed without exit_price/pnl)` }
			: { name: "trade-validity", status: "pass", detail: "every trade has positive qty, positive entry, and closed trades carry exit_price + pnl" },
	);

	// Single exposure: a bot may hold at most one open trade at a time.
	const multiOpen = (
		await db
			.prepare("SELECT bot_id, COUNT(*) as n FROM trades WHERE outcome = 'open' GROUP BY bot_id HAVING COUNT(*) > 1")
			.all<{ bot_id: number; n: number }>()
	).results;
	checks.push(
		multiOpen.length > 0
			? { name: "single-exposure", status: "fail", detail: `bots with multiple open trades: ${multiOpen.map((m) => m.bot_id).join(", ")}` }
			: { name: "single-exposure", status: "pass", detail: "no bot holds more than one open trade" },
	);

	// Capital floor: the kill-switch should pause any active bot below 40% of
	// its starting balance — an active bot under the floor is a warning.
	const drained = (
		await db
			.prepare("SELECT name FROM bots WHERE status = 'active' AND balance < 0.4 * starting_balance")
			.all<{ name: string }>()
	).results;
	checks.push(
		drained.length > 0
			? { name: "capital-floor", status: "warn", detail: `active bots below 40% of starting balance (kill-switch missed them): ${drained.map((b) => b.name).join(", ")}` }
			: { name: "capital-floor", status: "pass", detail: "no active bot below 40% of its starting balance" },
	);

	// Evidence freshness: a colony with bots but zero closed trades has nothing
	// to learn from yet.
	const botCount = await db.prepare("SELECT COUNT(*) as n FROM bots").first<{ n: number }>();
	const closedCount = await db.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome != 'open'").first<{ n: number }>();
	checks.push(
		(botCount?.n ?? 0) > 0 && (closedCount?.n ?? 0) === 0
			? { name: "evidence-freshness", status: "warn", detail: "no evidence yet — run cycles" }
			: { name: "evidence-freshness", status: "pass", detail: `${closedCount?.n ?? 0} closed trades on record for ${botCount?.n ?? 0} bots` },
	);

	return { ok: checks.every((c) => c.status !== "fail"), checks };
}

// Records an audit into the Databank: checks rows, an Observer report, the
// Invest realm's status light, and the ledger-integrity goal.
export async function recordAudit(db: D1Database, audit: AuditResult): Promise<void> {
	const pass = audit.checks.filter((c) => c.status === "pass").length;
	const warn = audit.checks.filter((c) => c.status === "warn").length;
	const fail = audit.checks.filter((c) => c.status === "fail").length;
	const realmStatus = fail > 0 ? "alert" : warn > 0 ? "watch" : "nominal";

	const statements = audit.checks.map((c) =>
		db
			.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('invest', ?, ?, ?)")
			.bind(c.name, c.status, c.detail),
	);
	statements.push(
		db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('observer', 'audit', ?, ?, ?, 'invest')")
			.bind(
				`Invest audit: ${audit.ok ? "ledger green" : "issues found"}`,
				`${audit.checks.length} checks: ${pass} pass, ${warn} warn, ${fail} fail.`,
				JSON.stringify(audit),
			),
	);
	statements.push(
		db.prepare("UPDATE realms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'invest'").bind(realmStatus),
	);
	statements.push(
		db
			.prepare(
				"UPDATE goals SET progress = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE title = 'Ledger integrity always green'",
			)
			.bind(audit.ok ? 1 : 0),
	);
	await db.batch(statements);
}
