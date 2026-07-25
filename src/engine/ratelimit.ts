// Sliding-window rate limiting + brute-force lockout, in D1.
//
// Constant-time secret comparison (secrets.ts) stops an attacker learning a
// secret byte by byte. It does nothing to stop them trying a million secrets.
// This is the other half of that door.
//
// Two distinct things are limited, because they fail differently:
//
//   CALL limits  — how often a valid caller may act. Protects the colony from
//                  a runaway loop or a noisy integration, not from an attacker.
//   AUTH limits  — how often a caller may fail authentication. This is the
//                  brute-force gate: exceed it and the bucket locks for a
//                  cooldown, so guessing a secret costs wall-clock time.
//
// A successful auth CLEARS the failure count, so a legitimate operator who
// fat-fingers a secret twice isn't punished once they get it right.
//
// Deliberately keyed by bucket name, not by IP: a Worker sees whatever
// CF-Connecting-IP the edge reports, and an attacker with a leaked secret is
// usually not the one we can distinguish by address. Locking the *door* rather
// than the *knocker* is the honest guarantee — it does mean a determined
// attacker can lock out a legitimate caller, which is the trade we accept for
// a shared-secret bridge.

export interface LimitVerdict {
	ok: boolean;
	retryAfter: number; // seconds; 0 when ok
	reason: string;
}

const OK: LimitVerdict = { ok: true, retryAfter: 0, reason: "" };

function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

interface Row {
	hits: number;
	window_start: number;
	locked_until: number;
}

// Check-and-consume one unit against a sliding window.
//   limit  — allowed hits per window
//   window — window length in seconds
//   lockFor — when >0, exceeding the limit locks the bucket for this long
//             (used for auth failures; call limits just shed the excess)
export async function consume(
	db: D1Database,
	bucket: string,
	limit: number,
	window: number,
	lockFor = 0,
): Promise<LimitVerdict> {
	const t = nowSec();
	const row = await db
		.prepare("SELECT hits, window_start, locked_until FROM rate_limits WHERE bucket = ?")
		.bind(bucket)
		.first<Row>();

	if (row && row.locked_until > t) {
		return { ok: false, retryAfter: row.locked_until - t, reason: "locked out after repeated failures" };
	}

	// Fresh bucket, or the previous window has rolled over.
	if (!row || t - row.window_start >= window) {
		await db
			.prepare(
				"INSERT INTO rate_limits (bucket, hits, window_start, locked_until, updated_at) VALUES (?, 1, ?, 0, CURRENT_TIMESTAMP)" +
					" ON CONFLICT(bucket) DO UPDATE SET hits = 1, window_start = ?, locked_until = 0, updated_at = CURRENT_TIMESTAMP",
			)
			.bind(bucket, t, t)
			.run();
		return OK;
	}

	const hits = row.hits + 1;
	if (hits > limit) {
		const lockUntil = lockFor > 0 ? t + lockFor : 0;
		await db
			.prepare("UPDATE rate_limits SET hits = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE bucket = ?")
			.bind(hits, lockUntil, bucket)
			.run();
		return {
			ok: false,
			retryAfter: lockFor > 0 ? lockFor : Math.max(1, window - (t - row.window_start)),
			reason: lockFor > 0 ? "too many failed attempts" : "rate limit exceeded",
		};
	}

	await db.prepare("UPDATE rate_limits SET hits = ?, updated_at = CURRENT_TIMESTAMP WHERE bucket = ?").bind(hits, bucket).run();
	return OK;
}

// A caller authenticated successfully — forgive the failures they accrued.
export async function clearFailures(db: D1Database, bucket: string): Promise<void> {
	await db.prepare("DELETE FROM rate_limits WHERE bucket = ?").bind(bucket).run();
}

// Tuned defaults. Auth is strict (secrets should be right the first time);
// call limits are generous enough that no honest integration notices them.
export const LIMITS = {
	auth: { limit: 5, window: 60, lockFor: 300 }, // 5 bad secrets/min → 5-minute lockout
	rp: { limit: 120, window: 60 }, // a busy Roblox server, comfortably
	local: { limit: 240, window: 60 }, // agent polls every ~5s = 12/min
	command: { limit: 60, window: 60 }, // the Jarvis bar, by hand
} as const;

export async function limitStatus(db: D1Database) {
	const t = nowSec();
	const rows = (
		await db
			.prepare("SELECT bucket, hits, window_start, locked_until FROM rate_limits ORDER BY updated_at DESC LIMIT 10")
			.all<{ bucket: string; hits: number; window_start: number; locked_until: number }>()
	).results;
	return {
		buckets: rows.map((r) => ({ ...r, locked: r.locked_until > t, secondsLeft: Math.max(0, r.locked_until - t) })),
		lockedNow: rows.filter((r) => r.locked_until > t).length,
	};
}
