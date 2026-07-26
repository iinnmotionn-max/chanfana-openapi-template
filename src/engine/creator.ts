// The control plane's lock.
//
// The authority ledger was built as the boundary on Lumi's power: nothing
// spends, publishes, acts unattended, or reaches the creator's machine without
// a granted scope. That reasoning had a hole big enough to walk through — the
// LEDGER ITSELF had no lock. `PATCH /command/authority` was open to anyone who
// knew the Worker URL, so an attacker's first move is simply:
//
//     PATCH /command/authority  {scope: "machine",  granted: true}
//     POST  /command            {order: "on my machine: ..."}
//
// A gate whose key is hanging on the gate is not a gate. Every "costs posture
// score" calculation in Shield quietly assumed only the creator could grant.
//
// The fix, without breaking a cockpit that must stay usable out of the box:
//
//   * Observe and operate — reading, trading, auditing, sweeping, studying —
//     stay open. They cannot move value, speak outward, or touch a machine,
//     and locking them would make the dashboard useless before setup.
//   * GRANTING spend / publish / command / machine, and issuing any order that
//     needs one, requires CREATOR_KEY.
//   * REVOKING is never gated. Reducing power must never need a credential —
//     if you've lost the key, you must still be able to shut the doors.
//
// When CREATOR_KEY is unset the dangerous half is simply unavailable, and says
// so. That is the honest default: not "insecure but warned about", which is
// how people get hurt, and not "everything locked", which would make a fresh
// checkout look broken.

import { secretsMatch } from "./secrets";

// Scopes whose grant is real-world consequential and must be locked.
export const GUARDED_SCOPES = ["spend", "publish", "command", "machine"] as const;

export function isGuarded(scope: string): boolean {
	return (GUARDED_SCOPES as readonly string[]).includes(scope);
}

export function creatorKeySet(env: unknown): boolean {
	const v = (env as Record<string, unknown> | null | undefined)?.CREATOR_KEY;
	return typeof v === "string" && v.length > 0;
}

// Did this request carry the creator's key? Header first, body second — the
// cockpit uses the header; a curl one-liner may find the body easier.
export function isCreator(env: unknown, provided: string): boolean {
	const key = (env as Record<string, unknown> | null | undefined)?.CREATOR_KEY;
	if (typeof key !== "string" || key.length === 0) return false;
	return secretsMatch(provided || "", key);
}

export const KEY_MISSING_NOTE =
	"This action needs the creator key. Set CREATOR_KEY on the Worker (npx wrangler secret put CREATOR_KEY) and send it as the X-Creator-Key header. Until then the system will not spend, publish, act unattended, or reach a machine — for anyone, including you.";

export const KEY_WRONG_NOTE = "Wrong creator key.";
