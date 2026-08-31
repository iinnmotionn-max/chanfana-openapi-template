// Secret rotation without downtime.
//
// The problem: a bridge secret is shared between the Worker and something
// outside it — a Roblox server, a local agent. Change it on one side and the
// other breaks instantly. That makes rotating a *compromised* secret feel
// expensive, which means in practice people don't do it, which means a leaked
// secret stays valid forever. The security control nobody can afford to use is
// not a security control.
//
// The fix is an overlap window. Each bridge accepts TWO secrets:
//
//     LOCAL_AGENT_SECRET            the current one — always accepted
//     LOCAL_AGENT_SECRET_PREVIOUS   the outgoing one — accepted, and flagged
//
// So a rotation is: set the new secret as current, move the old one to
// PREVIOUS, update your agents at your own pace, then delete PREVIOUS. No
// window where the bridge is down.
//
// The deliberate part: a call that authenticates on the PREVIOUS secret is
// accepted but RECORDED, and Shield surfaces it. An overlap window you forget
// to close is just two valid secrets — so the system nags until you close it.

import { secretsMatch } from "./secrets";

export type KeyAge = "current" | "previous" | null;

function readEnv(env: unknown, key: string): string {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" ? v : "";
}

// Which of a bridge's secrets did this caller present? null = neither.
export function matchSecret(env: unknown, envKey: string, provided: string): KeyAge {
	const current = readEnv(env, envKey);
	if (current && secretsMatch(provided, current)) return "current";
	const previous = readEnv(env, `${envKey}_PREVIOUS`);
	if (previous && secretsMatch(provided, previous)) return "previous";
	return null;
}

// A bridge is configured if it has a current secret at all.
export function isConfigured(env: unknown, envKey: string): boolean {
	return readEnv(env, envKey).length > 0;
}

// Note a call that came in on the outgoing secret, so the overlap window is
// visible and closeable rather than silently permanent.
export async function noteLegacyUse(db: D1Database, bridge: string, host: string): Promise<void> {
	await db
		.prepare(
			"INSERT INTO rotation_events (bridge, host) VALUES (?, ?)",
		)
		.bind(bridge, host.slice(0, 80))
		.run();
}

export interface RotationStatus {
	bridge: string;
	rotating: boolean; // a PREVIOUS secret is set
	legacyCalls: number; // callers still using it (last 7 days)
	lastLegacyAt: string | null;
	advice: string;
}

export async function rotationStatus(db: D1Database, env: unknown): Promise<RotationStatus[]> {
	const bridges = [
		{ bridge: "local agent", key: "LOCAL_AGENT_SECRET" },
		{ bridge: "roblox city", key: "RP_SHARED_SECRET" },
	];
	const out: RotationStatus[] = [];
	for (const b of bridges) {
		if (!isConfigured(env, b.key)) continue;
		const rotating = readEnv(env, `${b.key}_PREVIOUS`).length > 0;
		const row = await db
			.prepare(
				"SELECT COUNT(*) as n, MAX(created_at) as last FROM rotation_events WHERE bridge = ? AND created_at > datetime('now', '-7 days')",
			)
			.bind(b.bridge)
			.first<{ n: number; last: string | null }>();
		const legacyCalls = row?.n ?? 0;
		out.push({
			bridge: b.bridge,
			rotating,
			legacyCalls,
			lastLegacyAt: row?.last ?? null,
			advice: !rotating
				? "Single active secret — nothing to close."
				: legacyCalls > 0
					? `Still ${legacyCalls} call(s) on the OLD secret. Update those callers, then remove ${b.key}_PREVIOUS.`
					: `No caller has used the old secret in 7 days — safe to remove ${b.key}_PREVIOUS and finish the rotation.`,
		});
	}
	return out;
}
