// In-app web3 wallet over the AETHER token ledger. A wallet is just an
// aether_accounts row (kind='wallet'); creating one adds a zero-balance row, so
// the fixed genesis supply stays conserved. Every value movement goes through
// transfer() — this layer never mints or destroys AETHER, it only opens
// addresses, routes sends, links a self-custody Sui address, and reads history.

import { transfer, type TokenError, type TransferResult } from "./token";

// A real address: 0x + 64 hex chars (Sui-style), from 32 bytes of CSPRNG.
export function newAddress(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return "0x" + hex;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

// Slugify a label into a safe owner handle.
function slugify(label: string): string {
	return label
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

async function ownerExists(db: D1Database, owner: string): Promise<boolean> {
	const row = await db.prepare("SELECT 1 AS one FROM aether_accounts WHERE owner = ?").bind(owner).first<{ one: number }>();
	return row !== null;
}

export interface Wallet {
	owner: string;
	address: string;
	balance: number;
}

// Open a new wallet: a fresh aether_accounts row at balance 0. Supply-neutral.
export async function createWallet(db: D1Database, label?: string): Promise<Wallet> {
	const address = newAddress();
	let owner: string;
	if (label && slugify(label)) {
		owner = slugify(label);
		if (await ownerExists(db, owner)) {
			// Collision: append 4 hex from the fresh address for uniqueness.
			owner = `${owner}-${address.slice(2, 6)}`;
		}
	} else {
		owner = "wallet-" + address.slice(2, 10);
	}
	await db
		.prepare("INSERT INTO aether_accounts (owner, kind, balance, address, updated_at) VALUES (?, 'wallet', 0, ?, CURRENT_TIMESTAMP)")
		.bind(owner, address)
		.run();
	return { owner, address, balance: 0 };
}

// Resolve a reference — an owner handle OR a 0x address — to the canonical owner.
export async function resolve(db: D1Database, ref: string): Promise<string | null> {
	if (!ref) return null;
	const byOwner = await db.prepare("SELECT owner FROM aether_accounts WHERE owner = ?").bind(ref).first<{ owner: string }>();
	if (byOwner) return byOwner.owner;
	const byAddress = await db
		.prepare("SELECT owner FROM aether_accounts WHERE address = ? AND address != ''")
		.bind(ref)
		.first<{ owner: string }>();
	return byAddress ? byAddress.owner : null;
}

// Send AETHER between wallets. Resolves both refs, then routes through the
// ledger's transfer(). Passes {error} straight through so callers can 400.
export async function sendAether(
	db: D1Database,
	fromRef: string,
	toRef: string,
	amount: number,
	memo = "",
): Promise<TransferResult | TokenError> {
	const from = await resolve(db, fromRef);
	if (from === null) return { error: `unknown wallet: ${fromRef}` };
	const to = await resolve(db, toRef);
	if (to === null) return { error: `unknown wallet: ${toRef}` };
	return transfer(db, from, to, amount, "wallet-send", memo);
}

// Link a self-custody Sui address to a wallet (does not move funds).
export async function linkSui(
	db: D1Database,
	ref: string,
	suiAddress: string,
): Promise<{ owner: string; sui_address: string } | TokenError> {
	if (!ADDRESS_RE.test(suiAddress)) return { error: "invalid Sui address" };
	const owner = await resolve(db, ref);
	if (owner === null) return { error: `unknown wallet: ${ref}` };
	await db
		.prepare("UPDATE aether_accounts SET sui_address = ?, updated_at = CURRENT_TIMESTAMP WHERE owner = ?")
		.bind(suiAddress, owner)
		.run();
	return { owner, sui_address: suiAddress };
}

export interface WalletHistoryEntry {
	direction: "in" | "out";
	counterparty: string;
	amount: number;
	kind: string;
	memo: string;
	created_at: string;
}

export interface WalletOverview {
	owner: string;
	address: string;
	sui_address: string;
	kind: string;
	balance: number;
	history: WalletHistoryEntry[];
}

// Full view of a wallet: its account plus its last 25 ledger entries, each
// tagged from this wallet's perspective (in/out + the counterparty).
export async function walletOverview(db: D1Database, ref: string): Promise<WalletOverview | TokenError> {
	const owner = await resolve(db, ref);
	if (owner === null) return { error: `unknown wallet: ${ref}` };
	const account = await db
		.prepare("SELECT owner, address, sui_address, kind, balance FROM aether_accounts WHERE owner = ?")
		.bind(owner)
		.first<{ owner: string; address: string; sui_address: string; kind: string; balance: number }>();
	if (!account) return { error: `unknown wallet: ${ref}` };
	const rows = (
		await db
			.prepare(
				"SELECT from_owner, to_owner, amount, kind, memo, created_at FROM aether_ledger WHERE from_owner = ? OR to_owner = ? ORDER BY id DESC LIMIT 25",
			)
			.bind(owner, owner)
			.all<{ from_owner: string; to_owner: string; amount: number; kind: string; memo: string; created_at: string }>()
	).results;
	const history: WalletHistoryEntry[] = rows.map((r) => {
		const out = r.from_owner === owner;
		return {
			direction: out ? "out" : "in",
			counterparty: out ? r.to_owner : r.from_owner,
			amount: Number(r.amount.toFixed(2)),
			kind: r.kind,
			memo: r.memo,
			created_at: r.created_at,
		};
	});
	return {
		owner: account.owner,
		address: account.address,
		sui_address: account.sui_address,
		kind: account.kind,
		balance: Number(account.balance.toFixed(2)),
		history,
	};
}

export interface WalletListEntry {
	owner: string;
	address: string;
	kind: string;
	balance: number;
	sui_address: string;
}

// Every wallet/account with its address, ordered by balance (richest first).
export async function walletList(db: D1Database): Promise<WalletListEntry[]> {
	const rows = (
		await db
			.prepare("SELECT owner, address, kind, balance, sui_address FROM aether_accounts ORDER BY balance DESC")
			.all<{ owner: string; address: string; kind: string; balance: number; sui_address: string }>()
	).results;
	return rows.map((r) => ({
		owner: r.owner,
		address: r.address,
		kind: r.kind,
		balance: Number(r.balance.toFixed(2)),
		sui_address: r.sui_address,
	}));
}
