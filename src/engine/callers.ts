// Who is walking through each inbound door.
//
// The three ways a shared secret goes wrong, and what covers each:
//
//   guessed   → ratelimit.ts  (lockout makes guessing cost time)
//   leaked    → rotation.ts   (replace it without downtime)
//   copied    → this file
//
// The third is the quiet one. Someone with a working secret produces traffic
// that looks exactly like yours. The only thing that distinguishes it is that
// it comes from a machine you've never seen — so the system learns which
// callers are normal, and asks about the first one that isn't.
//
// It asks ONCE. A new caller is not evidence of anything; you might have set
// up a second game server this morning. So it's a question with an answer
// (trust it), not an alarm that keeps ringing.
//
// The honest limit, repeated where it can't be missed: the caller name is
// SELF-REPORTED. A thief holding your secret can send any name they like,
// including one you already trust. This raises the cost of quiet misuse and
// gives you a chance to notice; it is not a second factor, and nothing here
// should be mistaken for one.

export interface BridgeCaller {
	bridge: string;
	caller: string;
	trusted: boolean;
	calls: number;
	firstSeen: string;
	lastSeen: string;
}

export interface CallerSighting {
	isNew: boolean; // never seen on this bridge before
	notable: boolean; // new AND this bridge already had an established caller
	trusted: boolean;
}

// Record an authenticated call. Returns whether this caller is one we've seen.
export async function noteCaller(db: D1Database, bridge: string, caller: string): Promise<CallerSighting> {
	const name = (caller || "").trim().slice(0, 80);
	if (!name) return { isNew: false, notable: false, trusted: true }; // anonymous call, nothing to learn

	const existing = await db
		.prepare("SELECT trusted FROM bridge_callers WHERE bridge = ? AND caller = ?")
		.bind(bridge, name)
		.first<{ trusted: number }>();

	if (existing) {
		await db
			.prepare("UPDATE bridge_callers SET calls = calls + 1, last_seen = CURRENT_TIMESTAMP WHERE bridge = ? AND caller = ?")
			.bind(bridge, name)
			.run();
		return { isNew: false, notable: false, trusted: existing.trusted === 1 };
	}

	// First caller on a fresh bridge is unremarkable — that's just setup, and
	// it becomes the baseline everything after is measured against. It is
	// trusted on arrival precisely so the NEXT new caller stands out.
	const known = await db.prepare("SELECT COUNT(*) as n FROM bridge_callers WHERE bridge = ?").bind(bridge).first<{ n: number }>();
	const isFirst = (known?.n ?? 0) === 0;

	await db
		.prepare("INSERT INTO bridge_callers (bridge, caller, trusted, calls) VALUES (?, ?, ?, 1)")
		.bind(bridge, name, isFirst ? 1 : 0)
		.run();

	return { isNew: true, notable: !isFirst, trusted: isFirst };
}

export async function callerRoster(db: D1Database): Promise<BridgeCaller[]> {
	const rows = (
		await db
			.prepare("SELECT bridge, caller, trusted, calls, first_seen, last_seen FROM bridge_callers ORDER BY bridge, last_seen DESC")
			.all<{ bridge: string; caller: string; trusted: number; calls: number; first_seen: string; last_seen: string }>()
	).results;
	return rows.map((r) => ({
		bridge: r.bridge,
		caller: r.caller,
		trusted: r.trusted === 1,
		calls: r.calls,
		firstSeen: r.first_seen,
		lastSeen: r.last_seen,
	}));
}

// The creator's answer to "is this yours?". Trusting is the normal case;
// untrusting exists so a mistaken trust can be taken back.
export async function setCallerTrust(db: D1Database, bridge: string, caller: string, trusted: boolean): Promise<BridgeCaller | { error: string }> {
	const row = await db.prepare("SELECT id FROM bridge_callers WHERE bridge = ? AND caller = ?").bind(bridge, caller).first<{ id: number }>();
	if (!row) return { error: `no caller "${caller}" on the ${bridge} bridge` };
	await db.prepare("UPDATE bridge_callers SET trusted = ? WHERE id = ?").bind(trusted ? 1 : 0, row.id).run();
	const all = await callerRoster(db);
	return all.find((c) => c.bridge === bridge && c.caller === caller)!;
}

// Callers that have never been vouched for. Shield asks about these.
export async function unknownCallers(db: D1Database): Promise<BridgeCaller[]> {
	return (await callerRoster(db)).filter((c) => !c.trusted);
}
