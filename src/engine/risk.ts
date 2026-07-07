// Risk gates for real capital: colony-level drawdown / exposure limits with a
// global halt. Every number is recomputed from raw bot and trade evidence in
// the Databank — the halt flag is the only stored state, because resuming after
// a breach is a human decision, never an automatic one.

export interface RiskStatus {
	halted: boolean;
	reason: string;
	drawdown: number; // 0..1, colony equity loss vs starting capital
	openPositions: number;
	maxDrawdown: number;
	maxOpenPositions: number;
	breaches: string[];
}

interface RiskConfigRow {
	max_drawdown: number;
	max_open_positions: number;
	halted: number;
	reason: string;
}

// Reads the stored config and recomputes drawdown / exposure from the ledger,
// folding any limit breaches into a status. Does not mutate anything.
export async function getRisk(db: D1Database): Promise<RiskStatus> {
	const config = await db
		.prepare("SELECT max_drawdown, max_open_positions, halted, reason FROM risk_config WHERE id = 1")
		.first<RiskConfigRow>();

	const maxDrawdown = config?.max_drawdown ?? 0.25;
	const maxOpenPositions = config?.max_open_positions ?? 8;
	const halted = (config?.halted ?? 0) !== 0;
	const reason = config?.reason ?? "";

	const equityRow = await db
		.prepare("SELECT COALESCE(SUM(balance), 0) as equity, COALESCE(SUM(starting_balance), 0) as starting FROM bots")
		.first<{ equity: number; starting: number }>();
	const equity = equityRow?.equity ?? 0;
	const starting = equityRow?.starting ?? 0;
	const drawdown = starting > 0 ? Math.max(0, 1 - equity / starting) : 0;

	const openRow = await db
		.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome = 'open'")
		.first<{ n: number }>();
	const openPositions = openRow?.n ?? 0;

	const breaches: string[] = [];
	if (drawdown > maxDrawdown) {
		breaches.push(`drawdown ${(drawdown * 100).toFixed(1)}% > cap ${(maxDrawdown * 100).toFixed(1)}%`);
	}
	if (openPositions > maxOpenPositions) {
		breaches.push(`${openPositions} open positions > cap ${maxOpenPositions}`);
	}

	return { halted, reason, drawdown, openPositions, maxDrawdown, maxOpenPositions, breaches };
}

// Evaluates risk and trips the global halt when a limit is breached and trading
// is not already halted, filing a Reg report. Never auto-resumes when breaches
// clear — that stays a human decision.
export async function evaluateRisk(db: D1Database): Promise<RiskStatus> {
	const status = await getRisk(db);

	if (status.breaches.length > 0 && !status.halted) {
		const reason = status.breaches.join("; ");
		await db.batch([
			db
				.prepare("UPDATE risk_config SET halted = 1, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
				.bind(reason),
			db
				.prepare(
					"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'risk', ?, ?, ?, 'invest')",
				)
				.bind("Risk gate tripped — trading halted", reason, JSON.stringify(status)),
		]);
		return { ...status, halted: true, reason };
	}

	return status;
}

// Whether the global halt is currently engaged.
export async function isHalted(db: D1Database): Promise<boolean> {
	const row = await db.prepare("SELECT halted FROM risk_config WHERE id = 1").first<{ halted: number }>();
	return (row?.halted ?? 0) !== 0;
}

// Engages or lifts the global halt by hand, recording the decision as a report.
export async function setHalt(db: D1Database, halted: boolean, reason: string): Promise<void> {
	await db.batch([
		db
			.prepare("UPDATE risk_config SET halted = ?, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
			.bind(halted ? 1 : 0, reason),
		db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'risk', ?, ?, ?, 'invest')")
			.bind(`Trading ${halted ? "halted" : "resumed"} by creator`, reason, JSON.stringify({ halted, reason })),
	]);
}
