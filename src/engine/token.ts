// The Aether token ledger — the colony's AI-credit currency, modelled on the
// Aether token on the Sui blockchain. Fixed genesis supply; every movement is
// a recorded, balanced transaction; no account can go negative. Rewards flow
// from the treasury (earning credits); spends flow back to it (burning credits
// against AI work). A real Sui settlement adapter plugs in behind this same
// interface — until then the ledger is the source of truth.

export const SYMBOL = "AETHER";
export const CHAIN = "sui";
export const GENESIS_SUPPLY = 1_000_000;

export interface TokenError {
	error: string;
}

export interface TransferResult {
	from: string;
	to: string;
	amount: number;
	kind: string;
	balances: Record<string, number>;
}

async function balanceOf(db: D1Database, owner: string): Promise<number | null> {
	const row = await db.prepare("SELECT balance FROM aether_accounts WHERE owner = ?").bind(owner).first<{ balance: number }>();
	return row ? row.balance : null;
}

// Move `amount` from one account to another and record it. Returns a TokenError
// (not a throw) on any rule violation so callers can decide how to react.
export async function transfer(
	db: D1Database,
	from: string,
	to: string,
	amount: number,
	kind: string,
	memo = "",
): Promise<TransferResult | TokenError> {
	if (!(amount > 0)) return { error: "amount must be positive" };
	if (from === to) return { error: "from and to must differ" };
	const fromBal = await balanceOf(db, from);
	if (fromBal === null) return { error: `unknown account: ${from}` };
	const toBal = await balanceOf(db, to);
	if (toBal === null) return { error: `unknown account: ${to}` };
	if (fromBal + 1e-9 < amount) return { error: `insufficient balance: ${from} has ${fromBal.toFixed(2)}, needs ${amount}` };

	await db.batch([
		db.prepare("UPDATE aether_accounts SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE owner = ?").bind(amount, from),
		db.prepare("UPDATE aether_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE owner = ?").bind(amount, to),
		db.prepare("INSERT INTO aether_ledger (from_owner, to_owner, amount, kind, memo) VALUES (?, ?, ?, ?, ?)").bind(from, to, amount, kind, memo),
	]);
	return { from, to, amount, kind, balances: { [from]: fromBal - amount, [to]: toBal + amount } };
}

// Reward: treasury → owner. Caps at whatever the treasury actually holds so a
// reward can never invent supply. Silently no-ops if the account is unknown or
// the treasury is dry (keeps AI hot-paths from throwing).
export async function reward(db: D1Database, owner: string, amount: number, reason: string): Promise<void> {
	if (!(amount > 0)) return;
	const treasury = (await balanceOf(db, "treasury")) ?? 0;
	const capped = Math.min(amount, treasury);
	if (capped <= 0) return;
	const target = await balanceOf(db, owner);
	if (target === null) return;
	await transfer(db, "treasury", owner, capped, "reward", reason);
}

// Spend: owner → treasury (burning AI credits back to the reserve).
export async function spend(db: D1Database, owner: string, amount: number, reason: string): Promise<TransferResult | TokenError> {
	return transfer(db, owner, "treasury", amount, "spend", reason);
}

export interface TokenOverview {
	symbol: string;
	chain: string;
	genesisSupply: number;
	totalSupply: number;
	circulating: number;
	treasury: number;
	accounts: { owner: string; kind: string; balance: number }[];
	ledger: { from_owner: string; to_owner: string; amount: number; kind: string; memo: string; created_at: string }[];
	reconciled: boolean;
}

export async function tokenOverview(db: D1Database): Promise<TokenOverview> {
	const [accounts, ledger] = await Promise.all([
		db.prepare("SELECT owner, kind, balance FROM aether_accounts ORDER BY balance DESC").all<{ owner: string; kind: string; balance: number }>(),
		db.prepare("SELECT from_owner, to_owner, amount, kind, memo, created_at FROM aether_ledger ORDER BY id DESC LIMIT 12").all(),
	]);
	const totalSupply = accounts.results.reduce((n, a) => n + a.balance, 0);
	const treasury = accounts.results.find((a) => a.owner === "treasury")?.balance ?? 0;
	return {
		symbol: SYMBOL,
		chain: CHAIN,
		genesisSupply: GENESIS_SUPPLY,
		totalSupply: Number(totalSupply.toFixed(2)),
		circulating: Number((totalSupply - treasury).toFixed(2)),
		treasury: Number(treasury.toFixed(2)),
		accounts: accounts.results.map((a) => ({ ...a, balance: Number(a.balance.toFixed(2)) })),
		ledger: ledger.results as TokenOverview["ledger"],
		reconciled: Math.abs(totalSupply - GENESIS_SUPPLY) < 0.01,
	};
}

// Supply integrity: total across all accounts must equal genesis, and no
// account may be negative. Returns a check for the Guardian sweep.
export async function auditSupply(db: D1Database): Promise<{ name: string; status: "pass" | "fail"; detail: string }> {
	const accounts = (await db.prepare("SELECT owner, balance FROM aether_accounts").all<{ owner: string; balance: number }>()).results;
	const total = accounts.reduce((n, a) => n + a.balance, 0);
	const negative = accounts.filter((a) => a.balance < -1e-9);
	if (negative.length > 0) {
		return { name: "aether-supply", status: "fail", detail: `negative balances: ${negative.map((a) => a.owner).join(", ")}` };
	}
	if (Math.abs(total - GENESIS_SUPPLY) >= 0.01) {
		return { name: "aether-supply", status: "fail", detail: `supply drift: ${total.toFixed(2)} != genesis ${GENESIS_SUPPLY}` };
	}
	return { name: "aether-supply", status: "pass", detail: `${SYMBOL} supply reconciles to ${GENESIS_SUPPLY} across ${accounts.length} accounts` };
}
