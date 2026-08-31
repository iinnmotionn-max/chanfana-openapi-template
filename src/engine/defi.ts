// The DeFi liquidity layer for AETHER — a Cetus-style constant-product AMM,
// yield vaults, and collateralised lending. The design invariant is supply
// integrity: AETHER is fixed at the genesis 1,000,000 and the Guardian sweep
// audits sum(aether_accounts.balance) == genesis. So EVERY AETHER movement here
// goes through transfer()/reward() between REAL ledger accounts — nothing is
// invented or destroyed. The pool custodies its AETHER in a real account
// ('defi_pool'). The paired "quote" (SUI) side is synthetic — tracked only as
// numbers on the pool row, since we do not custody real SUI until a real Cetus
// pool is linked. Vault yield is paid from the treasury (a real reward()), so
// even earned interest stays within the fixed supply.

import { reward, transfer } from "./token";

const POOL_NAME = "AETHER/SUI";

export interface Pool {
	id: number;
	name: string;
	reserve_aether: number;
	reserve_quote: number;
	lp_supply: number;
	fee_bps: number;
	volume: number;
	fees_accrued: number;
	created_at: string;
}

interface DefiError {
	error: string;
}

async function getPool(db: D1Database): Promise<Pool> {
	const pool = await db.prepare("SELECT * FROM pools WHERE name = ? LIMIT 1").bind(POOL_NAME).first<Pool>();
	// The pool is seeded by migration 0012; this is a hard invariant.
	return pool as Pool;
}

async function logEvent(db: D1Database, kind: string, owner: string, amount: number, detail = ""): Promise<void> {
	await db
		.prepare("INSERT INTO defi_events (kind, owner, amount, detail) VALUES (?, ?, ?, ?)")
		.bind(kind, owner, amount, detail)
		.run();
}

async function upsertPosition(db: D1Database, owner: string, poolId: number, delta: number): Promise<void> {
	const row = await db
		.prepare("SELECT id, lp FROM lp_positions WHERE owner = ? AND pool_id = ?")
		.bind(owner, poolId)
		.first<{ id: number; lp: number }>();
	if (row) {
		await db
			.prepare("UPDATE lp_positions SET lp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
			.bind(row.lp + delta, row.id)
			.run();
	} else {
		await db
			.prepare("INSERT INTO lp_positions (owner, pool_id, lp, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)")
			.bind(owner, poolId, delta)
			.run();
	}
}

// Add liquidity: the LP moves real AETHER into the pool account, and posts the
// matching (synthetic) quote. LP tokens minted on the geometric mean for the
// first deposit, else pro-rata on the smaller of the two contributions.
export async function addLiquidity(
	db: D1Database,
	owner: string,
	aetherAmount: number,
	quoteAmount: number,
): Promise<{ lpMinted: number; pool: Pool } | DefiError> {
	const move = await transfer(db, owner, "defi_pool", aetherAmount, "lp-add", "add liquidity");
	if ("error" in move) return move;

	const pool = await getPool(db);
	const lpMinted =
		pool.lp_supply <= 0
			? Math.sqrt(aetherAmount * quoteAmount)
			: Math.min(aetherAmount / pool.reserve_aether, quoteAmount / pool.reserve_quote) * pool.lp_supply;

	await db
		.prepare("UPDATE pools SET reserve_aether = ?, reserve_quote = ?, lp_supply = ? WHERE id = ?")
		.bind(pool.reserve_aether + aetherAmount, pool.reserve_quote + quoteAmount, pool.lp_supply + lpMinted, pool.id)
		.run();
	await upsertPosition(db, owner, pool.id, lpMinted);
	await logEvent(db, "lp-add", owner, aetherAmount, `+${lpMinted.toFixed(4)} LP (${quoteAmount} quote)`);

	return { lpMinted, pool: await getPool(db) };
}

// Remove liquidity: burn the LP share and return the pro-rata AETHER (real,
// pool → owner) and quote (synthetic).
export async function removeLiquidity(
	db: D1Database,
	owner: string,
	lpAmount: number,
): Promise<{ aetherOut: number; quoteOut: number } | DefiError> {
	const pool = await getPool(db);
	if (!(pool.lp_supply > 0)) return { error: "no liquidity" };
	const share = lpAmount / pool.lp_supply;
	const aetherOut = share * pool.reserve_aether;
	const quoteOut = share * pool.reserve_quote;

	const move = await transfer(db, "defi_pool", owner, aetherOut, "lp-remove", "remove liquidity");
	if ("error" in move) return move;

	await db
		.prepare("UPDATE pools SET reserve_aether = ?, reserve_quote = ?, lp_supply = ? WHERE id = ?")
		.bind(pool.reserve_aether - aetherOut, pool.reserve_quote - quoteOut, pool.lp_supply - lpAmount, pool.id)
		.run();
	await upsertPosition(db, owner, pool.id, -lpAmount);
	await logEvent(db, "lp-remove", owner, aetherOut, `-${lpAmount.toFixed(4)} LP`);

	return { aetherOut, quoteOut };
}

// Constant-product swap (x*y=k) with a fee. AETHER always moves through the
// ledger — 'aether_in' pushes it owner → pool, 'quote_in' pulls AETHER
// pool → owner. The quote side is bookkeeping only.
export async function swap(
	db: D1Database,
	owner: string,
	direction: "aether_in" | "quote_in",
	amountIn: number,
): Promise<{ amountOut: number; priceAfter: number } | DefiError> {
	const pool = await getPool(db);
	if (!(pool.reserve_aether > 0) || !(pool.reserve_quote > 0)) return { error: "no liquidity" };

	const k = pool.reserve_aether * pool.reserve_quote;
	const feeRate = pool.fee_bps / 10000;
	const inAfterFee = amountIn * (1 - feeRate);

	let amountOut: number;
	let newReserveA: number;
	let newReserveQ: number;

	if (direction === "aether_in") {
		amountOut = pool.reserve_quote - k / (pool.reserve_aether + inAfterFee);
		const move = await transfer(db, owner, "defi_pool", amountIn, "swap", "aether_in");
		if ("error" in move) return move;
		newReserveA = pool.reserve_aether + amountIn;
		newReserveQ = pool.reserve_quote - amountOut;
	} else {
		amountOut = pool.reserve_aether - k / (pool.reserve_quote + inAfterFee);
		const move = await transfer(db, "defi_pool", owner, amountOut, "swap", "quote_in");
		if ("error" in move) return move;
		newReserveA = pool.reserve_aether - amountOut;
		newReserveQ = pool.reserve_quote + amountIn;
	}

	await db
		.prepare("UPDATE pools SET reserve_aether = ?, reserve_quote = ?, volume = ?, fees_accrued = ? WHERE id = ?")
		.bind(newReserveA, newReserveQ, pool.volume + amountIn, pool.fees_accrued + amountIn * feeRate, pool.id)
		.run();
	await logEvent(db, "swap", owner, amountIn, `${direction} → ${amountOut.toFixed(4)}`);

	return { amountOut, priceAfter: newReserveQ / newReserveA };
}

// A fee-yield estimate (fraction): accrued fees over the AETHER reserve.
export function poolApr(pool: Pool): number {
	return pool.reserve_aether > 0 ? pool.fees_accrued / pool.reserve_aether : 0;
}

// Vault deposit: real AETHER owner → pool, credited as vault principal.
export async function vaultDeposit(
	db: D1Database,
	owner: string,
	amount: number,
): Promise<{ deposited: number; principal: number } | DefiError> {
	const move = await transfer(db, owner, "defi_pool", amount, "vault-deposit", "vault deposit");
	if ("error" in move) return move;

	const vault = await db
		.prepare("SELECT id, principal FROM vaults WHERE owner = ?")
		.bind(owner)
		.first<{ id: number; principal: number }>();
	if (vault) {
		await db
			.prepare("UPDATE vaults SET principal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
			.bind(vault.principal + amount, vault.id)
			.run();
	} else {
		await db
			.prepare("INSERT INTO vaults (owner, principal, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
			.bind(owner, amount)
			.run();
	}
	await logEvent(db, "vault-deposit", owner, amount, "");

	const principal = (vault?.principal ?? 0) + amount;
	return { deposited: amount, principal };
}

// Vault withdraw: pay yield from the TREASURY (a real reward() — conserves the
// fixed supply), then return the principal from the pool account.
export async function vaultWithdraw(
	db: D1Database,
	owner: string,
	amount: number,
): Promise<{ withdrawn: number; yield: number } | DefiError> {
	const vault = await db
		.prepare("SELECT id, principal, apr_bps FROM vaults WHERE owner = ?")
		.bind(owner)
		.first<{ id: number; principal: number; apr_bps: number }>();
	if (!vault || vault.principal + 1e-9 < amount) return { error: "insufficient vault principal" };

	const yieldAmount = (amount * vault.apr_bps) / 10000;
	await reward(db, owner, yieldAmount, "vault-yield");

	const move = await transfer(db, "defi_pool", owner, amount, "vault-withdraw", "vault withdraw");
	if ("error" in move) return move;

	await db
		.prepare("UPDATE vaults SET principal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
		.bind(vault.principal - amount, vault.id)
		.run();
	await logEvent(db, "vault-withdraw", owner, amount, `yield ${yieldAmount.toFixed(4)}`);

	return { withdrawn: amount, yield: yieldAmount };
}

// Borrow against AETHER collateral at a 50% LTV. The collateral is locked (real
// AETHER owner → pool). The borrowed quote is SYNTHETIC — no ledger entry,
// because we don't custody real SUI; it's recorded on the loan row only.
export async function borrow(
	db: D1Database,
	owner: string,
	collateralAether: number,
	borrowQuote: number,
): Promise<{ loanId: number; maxBorrow: number; price: number } | DefiError> {
	const pool = await getPool(db);
	const price = pool.reserve_aether > 0 ? pool.reserve_quote / pool.reserve_aether : 1;
	const maxBorrow = 0.5 * collateralAether * price;
	if (borrowQuote > maxBorrow) return { error: "exceeds 50% LTV" };

	const move = await transfer(db, owner, "defi_pool", collateralAether, "loan-collateral", "lock collateral");
	if ("error" in move) return move;

	const loan = await db
		.prepare("INSERT INTO loans (owner, collateral_aether, principal_quote) VALUES (?, ?, ?) RETURNING id")
		.bind(owner, collateralAether, borrowQuote)
		.first<{ id: number }>();
	await logEvent(db, "borrow", owner, collateralAether, `borrow ${borrowQuote} quote (synthetic)`);

	return { loanId: loan!.id, maxBorrow, price };
}

// Repay a loan: return the locked collateral (real AETHER pool → owner) and
// close it. The synthetic quote principal is simply cleared with the row.
export async function repay(db: D1Database, loanId: number): Promise<{ repaid: true } | DefiError> {
	const loan = await db
		.prepare("SELECT id, owner, collateral_aether FROM loans WHERE id = ? AND status = 'open'")
		.bind(loanId)
		.first<{ id: number; owner: string; collateral_aether: number }>();
	if (!loan) return { error: "no open loan" };

	const move = await transfer(db, "defi_pool", loan.owner, loan.collateral_aether, "loan-repay", "return collateral");
	if ("error" in move) return move;

	await db.prepare("UPDATE loans SET status = 'repaid' WHERE id = ?").bind(loanId).run();
	await logEvent(db, "repay", loan.owner, loan.collateral_aether, `loan ${loanId} repaid`);

	return { repaid: true };
}

// A consolidated read of the whole DeFi layer for the dashboard: pools with
// derived price/APR, vaults, open loans, recent events, total AETHER TVL, and
// the pool's real ledger balance (which backs every pool/vault/loan movement).
export async function defiOverview(db: D1Database) {
	const [pools, vaults, loans, events, poolBal] = await Promise.all([
		db.prepare("SELECT * FROM pools ORDER BY id").all<Pool>(),
		db.prepare("SELECT * FROM vaults ORDER BY id").all<{ owner: string; principal: number; apr_bps: number }>(),
		db
			.prepare("SELECT * FROM loans WHERE status = 'open' ORDER BY id DESC")
			.all<{ id: number; owner: string; collateral_aether: number; principal_quote: number; rate_bps: number; status: string }>(),
		db.prepare("SELECT * FROM defi_events ORDER BY id DESC LIMIT 12").all(),
		db.prepare("SELECT balance FROM aether_accounts WHERE owner = 'defi_pool'").first<{ balance: number }>(),
	]);

	const tvlAether =
		pools.results.reduce((n, p) => n + p.reserve_aether, 0) +
		vaults.results.reduce((n, v) => n + v.principal, 0) +
		loans.results.reduce((n, l) => n + l.collateral_aether, 0);

	return {
		pools: pools.results.map((p) => ({
			...p,
			price: p.reserve_aether > 0 ? p.reserve_quote / p.reserve_aether : 0,
			tvlAether: p.reserve_aether,
			apr: poolApr(p),
		})),
		vaults: vaults.results,
		loans: loans.results,
		events: events.results,
		tvlAether,
		poolBalance: poolBal?.balance ?? 0,
	};
}
