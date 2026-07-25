// InMotion RP — the bridge between the Roblox roleplay city and the AETHER
// economy. A Roblox game server calls POST /rp/grant to credit a player's
// in-ecosystem AETHER when they earn it in the city (paychecks, jobs, events).
//
// Honest by default: the bridge is OFF until the operator sets RP_SHARED_SECRET.
// Every grant flows treasury → player through the ledger's reward(), so the
// fixed AETHER supply stays conserved and the Guardian audit keeps passing.
// The game never mints — it asks the treasury, which caps at what it holds.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { reward, spend } from "../engine/token";
import { newAddress, walletOverview } from "../engine/wallet";
import { secretsMatch } from "../engine/secrets";
import { clearFailures, consume, LIMITS } from "../engine/ratelimit";

function configuredSecret(env: unknown): string {
	const v = (env as Record<string, unknown> | null | undefined)?.RP_SHARED_SECRET;
	return typeof v === "string" ? v : "";
}

// Same two-tier gate as the local agent: failed secrets lock the door,
// call volume is capped so a looping game server can't flood the ledger.
async function rpGate(c: AppContext, provided: string): Promise<Response | null> {
	const secret = configuredSecret(c.env);
	if (!secret) {
		return c.json({ success: false, errors: [{ code: 5031, message: "RP bridge disabled — set RP_SHARED_SECRET" }] }, 503);
	}
	const locked = await consume(c.env.DB, "auth:rp", LIMITS.auth.limit, LIMITS.auth.window, LIMITS.auth.lockFor);
	if (!locked.ok) {
		return c.json({ success: false, errors: [{ code: 4290, message: `Too many failed attempts — retry in ${locked.retryAfter}s` }] }, 429, {
			"Retry-After": String(locked.retryAfter),
		});
	}
	if (!secretsMatch(provided, secret)) {
		return c.json({ success: false, errors: [{ code: 4011, message: "Bad shared secret" }] }, 401);
	}
	await clearFailures(c.env.DB, "auth:rp");
	const called = await consume(c.env.DB, "call:rp", LIMITS.rp.limit, LIMITS.rp.window);
	if (!called.ok) {
		return c.json({ success: false, errors: [{ code: 4291, message: `Rate limit exceeded — retry in ${called.retryAfter}s` }] }, 429, {
			"Retry-After": String(called.retryAfter),
		});
	}
	return null;
}

// A stable, safe owner handle for a Roblox player: rp-<userId>.
function rpOwner(userId: number): string {
	return `rp-${Math.trunc(userId)}`;
}

// Open the player's AETHER wallet once (zero balance — supply-neutral), then
// return the canonical owner handle. Idempotent. A first-time citizen is
// chronicled in the Gaming realm's feed.
async function ensureRpWallet(db: D1Database, userId: number, name: string): Promise<string> {
	const owner = rpOwner(userId);
	const exists = await db.prepare("SELECT 1 AS one FROM aether_accounts WHERE owner = ?").bind(owner).first<{ one: number }>();
	if (!exists) {
		await db
			.prepare("INSERT INTO aether_accounts (owner, kind, balance, address, updated_at) VALUES (?, 'rp', 0, ?, CURRENT_TIMESTAMP)")
			.bind(owner, newAddress())
			.run();
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'citizen', ?, ?, ?, 'gaming')")
			.bind(
				`New citizen: ${name || owner}`,
				`${name || owner} opened an AETHER wallet in InMotion RP (${owner}).`,
				JSON.stringify({ userId, owner, name }),
			)
			.run();
	} else if (name) {
		// keep the display name fresh without touching balance
		await db.prepare("UPDATE aether_accounts SET updated_at = CURRENT_TIMESTAMP WHERE owner = ?").bind(owner).run();
	}
	return owner;
}

// Every successful bridge call stamps a passing rp-bridge check, so the Gaming
// realm's status reflects a live, working bridge in the cockpit.
async function recordBridgeCheck(db: D1Database, detail: string): Promise<void> {
	await db.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('gaming', 'rp-bridge', 'pass', ?)").bind(detail).run();
}

export class RpGrant extends OpenAPIRoute {
	public schema = {
		tags: ["InMotion RP"],
		summary: "Credit AETHER to a Roblox player (treasury → player, supply-conserved)",
		request: {
			body: contentJson(
				z.object({
					userId: z.number().int().positive(),
					name: z.string().max(50).optional(),
					amount: z.number().positive().max(100000),
					reason: z.string().max(120).default("rp"),
					secret: z.string().default(""),
				}),
			),
		},
		responses: {
			"200": { description: "AETHER credited", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"401": { description: "Bad shared secret" },
			"503": { description: "RP bridge disabled (RP_SHARED_SECRET not set)" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const denied = await rpGate(c, body.secret);
		if (denied) return denied;

		const owner = await ensureRpWallet(c.env.DB, body.userId, body.name ?? "");
		const before = await c.env.DB.prepare("SELECT balance FROM aether_accounts WHERE owner = ?").bind(owner).first<{ balance: number }>();
		await reward(c.env.DB, owner, body.amount, `rp:${body.reason}`);
		const after = await c.env.DB.prepare("SELECT balance FROM aether_accounts WHERE owner = ?").bind(owner).first<{ balance: number }>();

		const granted = Number(((after?.balance ?? 0) - (before?.balance ?? 0)).toFixed(2));
		await recordBridgeCheck(c.env.DB, `grant ${granted} AETHER to ${owner} (${body.reason})`);
		return {
			success: true,
			result: {
				userId: body.userId,
				owner,
				granted, // may be < amount if the treasury is nearly dry (never invents supply)
				balance: Number((after?.balance ?? 0).toFixed(2)),
			},
		};
	}
}

export class RpSpend extends OpenAPIRoute {
	public schema = {
		tags: ["InMotion RP"],
		summary: "A player spends AETHER in the city (player → treasury, supply-conserved)",
		request: {
			body: contentJson(
				z.object({
					userId: z.number().int().positive(),
					amount: z.number().positive().max(100000),
					reason: z.string().max(120).default("purchase"),
					secret: z.string().default(""),
				}),
			),
		},
		responses: {
			"200": { description: "AETHER spent", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Insufficient balance or unknown player" },
			"401": { description: "Bad shared secret" },
			"503": { description: "RP bridge disabled (RP_SHARED_SECRET not set)" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const denied = await rpGate(c, body.secret);
		if (denied) return denied;

		// Spends only debit an existing wallet — a player with no wallet has
		// nothing to spend, so unlike grants we don't create one here.
		const owner = rpOwner(body.userId);
		const result = await spend(c.env.DB, owner, body.amount, `rp:${body.reason}`);
		if ("error" in result) {
			return c.json({ success: false, errors: [{ code: 4001, message: result.error }] }, 400);
		}
		await recordBridgeCheck(c.env.DB, `spend ${body.amount} AETHER by ${owner} (${body.reason})`);
		return {
			success: true,
			result: {
				userId: body.userId,
				owner,
				spent: body.amount,
				balance: Number(result.balances[owner].toFixed(2)),
			},
		};
	}
}

export class RpPlayer extends OpenAPIRoute {
	public schema = {
		tags: ["InMotion RP"],
		summary: "A Roblox player's AETHER wallet (balance + recent history)",
		request: { params: z.object({ userId: z.coerce.number().int().positive() }) },
		responses: {
			"200": { description: "Player wallet", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"404": { description: "No wallet for this player yet" },
		},
	};

	public async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const view = await walletOverview(c.env.DB, rpOwner(params.userId));
		if ("error" in view) {
			return c.json({ success: false, errors: [{ code: 4042, message: "No wallet for this player yet" }] }, 404);
		}
		return { success: true, result: view };
	}
}
