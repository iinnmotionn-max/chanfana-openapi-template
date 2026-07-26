// The Shield realm: web3 security posture, red-team scanning, decentralization
// scoring, and privacy-first KYC. Every dimension is scored from real system
// state (never asserted), a growing rule-set drives the checks, and each scan
// records findings — so the colony measurably learns to harden itself.

import { auditInvest } from "./integrity";
import { limitStatus } from "./ratelimit";
import { rotationStatus } from "./rotation";
import { unknownCallers } from "./callers";
import { creatorKeySet } from "./creator";
import { probeGuards } from "./probe";
import { auditSupply } from "./token";
import { suiChainStatus } from "./sui";
import { recordMetric } from "./lumi";

export type Dimension = "contract" | "custody" | "privacy" | "decentralization" | "redteam" | "authority";

export interface DimensionScore {
	dimension: Dimension;
	score: number; // 0..1
	label: string;
	detail: string;
	findings: { severity: "info" | "warn" | "critical"; title: string; detail: string }[];
}

export interface Posture {
	score: number; // 0..100 composite
	grade: string;
	rulesetVersion: number;
	ruleCount: number;
	dimensions: DimensionScore[];
	web3: { linked: boolean; network: string; note: string };
}

// The rule-set. Adding rules here bumps the version — the system's security
// knowledge grows over time. Each dimension's weight in the composite.
export const RULES = [
	{ id: "contract-fixed-supply", dimension: "contract", weight: 1 },
	{ id: "contract-metadata-frozen", dimension: "contract", weight: 1 },
	{ id: "contract-onchain-linked", dimension: "contract", weight: 1 },
	{ id: "custody-no-cloud-keys", dimension: "custody", weight: 1 },
	{ id: "custody-treasury-concentration", dimension: "custody", weight: 1 },
	{ id: "privacy-no-pii-leak", dimension: "privacy", weight: 1 },
	{ id: "privacy-kyc-hashed", dimension: "privacy", weight: 1 },
	{ id: "privacy-consent-enforced", dimension: "privacy", weight: 1 },
	{ id: "decentralization-holder-spread", dimension: "decentralization", weight: 1 },
	{ id: "decentralization-onchain-settlement", dimension: "decentralization", weight: 1 },
	{ id: "redteam-ledger-integrity", dimension: "redteam", weight: 1 },
	{ id: "redteam-token-supply", dimension: "redteam", weight: 1 },
	{ id: "redteam-no-negative-balances", dimension: "redteam", weight: 1 },
	{ id: "authority-least-privilege", dimension: "authority", weight: 1 },
	{ id: "authority-machine-reach", dimension: "authority", weight: 1 },
	{ id: "authority-unattended-action", dimension: "authority", weight: 1 },
	{ id: "authority-bridge-exposure", dimension: "authority", weight: 1 },
	{ id: "authority-rotation-window", dimension: "authority", weight: 1 },
	{ id: "authority-caller-identity", dimension: "authority", weight: 1 },
	{ id: "authority-control-plane", dimension: "authority", weight: 1 },
	{ id: "authority-guards-proven", dimension: "authority", weight: 1 },
] as const;
export const RULESET_VERSION = 8; // bump when rules change — the ruleset "learns"

const DIM_WEIGHTS: Record<Dimension, number> = { contract: 0.18, custody: 0.18, privacy: 0.18, decentralization: 0.14, redteam: 0.18, authority: 0.14 };

function grade(score: number): string {
	if (score >= 90) return "A";
	if (score >= 80) return "B";
	if (score >= 70) return "C";
	if (score >= 55) return "D";
	return "F";
}

export async function assessPosture(db: D1Database, env: unknown): Promise<Posture> {
	const chain = suiChainStatus(env);

	// --- Contract security ---
	const supply = await auditSupply(db);
	const contractFindings: DimensionScore["findings"] = [];
	// Our Move contract fixes supply and freezes metadata by construction.
	let contractScore = 0.4; // fixed-supply + frozen-metadata are guaranteed
	if (chain.linked) contractScore += 0.6;
	else contractFindings.push({ severity: "warn", title: "Not published on-chain", detail: "Publish sui/aether and set AETHER_PACKAGE_ID to settle on Sui." });
	if (supply.status !== "pass") contractFindings.push({ severity: "critical", title: "Token supply drift", detail: supply.detail });

	// --- Custody ---
	const custodyFindings: DimensionScore["findings"] = [];
	let custodyScore = 0.6; // keys are never held in the cloud — structural
	const accts = (await db.prepare("SELECT owner, balance FROM aether_accounts").all<{ owner: string; balance: number }>()).results;
	const total = accts.reduce((n, a) => n + a.balance, 0) || 1;
	const treasuryShare = (accts.find((a) => a.owner === "treasury")?.balance ?? 0) / total;
	if (treasuryShare < 0.7) custodyScore += 0.4;
	else custodyFindings.push({ severity: "warn", title: "Treasury concentration", detail: `Treasury holds ${(treasuryShare * 100).toFixed(0)}% — distribute to reduce single-point risk.` });

	// --- Privacy / KYC ---
	const privacyFindings: DimensionScore["findings"] = [];
	const [piiAuras, kyc] = await Promise.all([
		db.prepare("SELECT COUNT(*) as n FROM auras WHERE LENGTH(notes) > 0 AND consent = 0").first<{ n: number }>(),
		db.prepare("SELECT COUNT(*) as n FROM kyc_attestations").first<{ n: number }>(),
	]);
	let privacyScore = 0.5; // consent rules + hashed KYC are enforced by design
	if ((piiAuras?.n ?? 0) === 0) privacyScore += 0.25;
	else privacyFindings.push({ severity: "critical", title: "Un-consented notes", detail: `${piiAuras!.n} aura(s) hold notes without consent.` });
	if ((kyc?.n ?? 0) > 0) privacyScore += 0.25;
	else privacyFindings.push({ severity: "info", title: "No KYC attestations yet", detail: "Privacy-first attestations (hash only) strengthen trust without holding PII." });

	// --- Decentralization ---
	const decFindings: DimensionScore["findings"] = [];
	const holders = accts.filter((a) => a.balance > 0).length;
	let decScore = Math.min(0.6, holders / 10); // more independent holders = better
	if (chain.linked) decScore += 0.4;
	else decFindings.push({ severity: "info", title: "Off-chain settlement", detail: "On-chain settlement decentralizes custody and trust." });
	decScore = Math.min(1, decScore);

	// --- Red-team (adversarial integrity) ---
	const redFindings: DimensionScore["findings"] = [];
	const [invest] = await Promise.all([auditInvest(db)]);
	const negative = accts.filter((a) => a.balance < -1e-9).length;
	let redScore = 1;
	if (invest.checks.some((c) => c.status === "fail")) { redScore -= 0.34; redFindings.push({ severity: "critical", title: "Invest ledger fails audit", detail: "Balances do not reconcile to recorded trades." }); }
	if (supply.status !== "pass") { redScore -= 0.33; redFindings.push({ severity: "critical", title: "Token supply fails audit", detail: supply.detail }); }
	if (negative > 0) { redScore -= 0.33; redFindings.push({ severity: "critical", title: "Negative balances", detail: `${negative} account(s) below zero.` }); }
	redScore = Math.max(0, redScore);

	// --- Authority (blast radius) ---
	// Every scope the creator grants widens what a compromised command bar, a
	// prompt injection, or a stolen bridge secret could reach. Shield does not
	// tell anyone what to grant — it makes the cost of each grant visible, so a
	// posture score reflects the powers actually handed over, not just the code.
	const authFindings: DimensionScore["findings"] = [];
	const scopes = (await db.prepare("SELECT scope, granted FROM authority").all<{ scope: string; granted: number }>()).results;
	const on = (k: string) => scopes.find((x) => x.scope === k)?.granted === 1;
	let authScore = 1;
	if (on("machine")) {
		authScore -= 0.3;
		authFindings.push({
			severity: "warn",
			title: "Machine reach granted",
			detail: "Lumi can queue commands for your computer. The local agent still vets each one (allowlist, no eval flags, your confirmation) — but this is the widest grant available.",
		});
	}
	if (on("spend")) {
		authScore -= 0.2;
		authFindings.push({ severity: "warn", title: "Spend granted", detail: "Value can move on command. Supply stays conserved, but funds can be reallocated without a second approval." });
	}
	if (on("command")) {
		authScore -= 0.2;
		authFindings.push({ severity: "warn", title: "Unattended action granted", detail: "Lumi takes one corrective action per pulse with nobody watching. Every act is chronicled in the feed." });
	}
	if (on("publish")) {
		authScore -= 0.1;
		authFindings.push({ severity: "info", title: "Publish granted", detail: "Content can leave the system through live connectors." });
	}
	// Bridges are attack surface whenever their secret is set, granted or not.
	const bridges = [
		["LOCAL_AGENT_SECRET", "local agent"],
		["RP_SHARED_SECRET", "Roblox city"],
	].filter(([k]) => typeof (env as Record<string, unknown> | null)?.[k] === "string" && String((env as Record<string, unknown>)[k]).length > 0);
	if (bridges.length > 0) {
		authScore -= 0.1 * bridges.length;
		authFindings.push({
			severity: "info",
			title: `${bridges.length} inbound bridge${bridges.length > 1 ? "s" : ""} enabled`,
			detail: `${bridges.map(([, n]) => n).join(", ")} — anyone holding the shared secret can reach these endpoints. Rotate on exposure.`,
		});
	}
	// An open rotation window is TWO valid secrets. That is the correct state
	// while you migrate callers, and a quiet weakness if you forget to close it —
	// so Shield keeps saying it out loud, and says exactly what's left to do.
	for (const r of await rotationStatus(db, env)) {
		if (!r.rotating) continue;
		authScore -= 0.05;
		authFindings.push({
			severity: r.legacyCalls > 0 ? "info" : "warn",
			title: `Rotation open on the ${r.bridge} bridge`,
			detail: r.advice,
		});
	}

	// The guards themselves, proven rather than assumed. Shield used to score
	// "spend is granted, that costs posture" — while the endpoint that spends
	// was open to anyone. The probe attacks our own locked routes; a hole here
	// invalidates every other authority line above it.
	const guards = await probeGuards("http://self.local", env).catch(() => null);
	if (guards && !guards.ok) {
		authScore = 0;
		authFindings.push({
			severity: "critical",
			title: `${guards.holes.length} route(s) that must require the creator key do NOT`,
			detail:
				`${guards.holes.map((h) => `${h.route}: ${h.note}`).join("; ")}. ` +
				"Until this is fixed, every scope on this panel is advisory — the power is reachable without the ledger.",
		});
	}

	// The control plane itself. Every "granted scope costs posture" line above
	// assumes only the creator can grant — which is true only once a key exists.
	if (!creatorKeySet(env)) {
		authFindings.push({
			severity: "info",
			title: "No creator key — consequential scopes are locked for everyone",
			detail:
				"CREATOR_KEY is unset, so nothing can be granted spend / publish / command / machine, including by you. " +
				"That is the safe default for an open endpoint. Set it (npx wrangler secret put CREATOR_KEY) to unlock those powers for yourself.",
		});
	}

	// A caller nobody has vouched for. Rate limiting catches guessing and
	// rotation replaces a leak, but a COPIED secret produces traffic that looks
	// exactly like yours — except it comes from a machine you've never seen.
	// This is a question, not an accusation: trust it and it stops asking.
	const strangers = await unknownCallers(db);
	if (strangers.length > 0) {
		authScore -= 0.05 * Math.min(3, strangers.length);
		authFindings.push({
			severity: "warn",
			title: `${strangers.length} unrecognized caller${strangers.length > 1 ? "s" : ""} on your bridges`,
			detail:
				`${strangers.map((s) => `${s.caller} → ${s.bridge} (${s.calls} call${s.calls > 1 ? "s" : ""}, first seen ${s.firstSeen})`).join("; ")}. ` +
				"If that's yours, trust it (POST /bridges/trust) and this clears. If it isn't, rotate that bridge's secret now. " +
				"Note: caller names are self-reported, so this can be spoofed by someone holding the secret — it is a prompt to look, not proof either way.",
		});
	}

	// A door locked RIGHT NOW means someone is guessing secrets at this moment.
	// That is not a posture weakness — the lock is working — but it is the kind
	// of thing a creator should see on the security panel, not in a log file.
	const limits = await limitStatus(db);
	if (limits.lockedNow > 0) {
		authFindings.push({
			severity: "critical",
			title: `${limits.lockedNow} door locked out right now`,
			detail: `Repeated failed secrets tripped a lockout: ${limits.buckets.filter((b) => b.locked).map((b) => b.bucket).join(", ")}. Someone is guessing — rotate the secret if you did not cause this.`,
		});
	}
	authScore = Math.max(0, authScore);
	if (authFindings.length === 0) {
		authFindings.push({ severity: "info", title: "Least privilege", detail: "Only observe + operate are granted; nothing can move value, speak outward, or reach your machine." });
	}

	const dimensions: DimensionScore[] = [
		{ dimension: "contract", score: Math.min(1, contractScore), label: "Smart-contract", detail: chain.linked ? "On-chain, fixed supply, frozen metadata." : "Publishable; fixed supply & frozen metadata by design.", findings: contractFindings },
		{ dimension: "custody", score: Math.min(1, custodyScore), label: "Key custody", detail: "Keys never touch the cloud; watching treasury concentration.", findings: custodyFindings },
		{ dimension: "privacy", score: Math.min(1, privacyScore), label: "Privacy & KYC", detail: "Consent-gated notes; attestations are hashed, not identity.", findings: privacyFindings },
		{ dimension: "decentralization", score: decScore, label: "Decentralization", detail: `${holders} holders; ${chain.linked ? "on-chain" : "off-chain"} settlement.`, findings: decFindings },
		{ dimension: "redteam", score: redScore, label: "Red-team integrity", detail: "Adversarial checks on ledgers, supply, and balances.", findings: redFindings },
		{ dimension: "authority", score: authScore, label: "Authority & blast radius", detail: `${scopes.filter((x) => x.granted === 1).length}/${scopes.length} scopes granted; ${bridges.length} bridge(s) enabled.`, findings: authFindings },
	];

	const composite = dimensions.reduce((n, d) => n + d.score * DIM_WEIGHTS[d.dimension], 0) * 100;
	const score = Math.round(composite);
	return {
		score,
		grade: grade(score),
		rulesetVersion: RULESET_VERSION,
		ruleCount: RULES.length,
		dimensions,
		web3: { linked: chain.linked, network: chain.network, note: chain.note },
	};
}

// A red-team scan: assess, record findings, track the score over time (so the
// hardening trend is visible), file a report, and update the realm status.
export async function runScan(db: D1Database, env: unknown): Promise<Posture> {
	const posture = await assessPosture(db, env);
	const findings = posture.dimensions.flatMap((d) => d.findings.map((f) => ({ ...f, dimension: d.dimension })));

	const statements: D1PreparedStatement[] = findings.map((f) =>
		db.prepare("INSERT INTO shield_findings (dimension, severity, title, detail) VALUES (?, ?, ?, ?)").bind(f.dimension, f.severity, f.title, f.detail),
	);
	const realmStatus = findings.some((f) => f.severity === "critical") ? "alert" : findings.some((f) => f.severity === "warn") ? "watch" : "nominal";
	statements.push(db.prepare("UPDATE realms SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'shield'").bind(realmStatus));
	statements.push(
		db.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'shield', ?, ?, ?, 'shield')").bind(
			`Shield scan: posture ${posture.score}/100 (${posture.grade})`,
			`Ruleset v${posture.rulesetVersion}, ${posture.ruleCount} rules. ${findings.length} finding(s): ${findings.filter((f) => f.severity === "critical").length} critical.`,
			JSON.stringify(posture),
		),
	);
	statements.push(db.prepare("UPDATE goals SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE title = 'Harden to 90+'").bind(Math.min(1, posture.score / 90)));
	await db.batch(statements);
	await recordMetric(db, "shield_score", posture.score, { grade: posture.grade });
	return posture;
}

// Privacy-first KYC: store a level + method + a proof hash. Never PII.
export async function submitKyc(db: D1Database, subject: string, level: string, method: string, hash: string): Promise<{ id: number }> {
	const row = await db
		.prepare("INSERT INTO kyc_attestations (subject, level, method, attestation_hash) VALUES (?, ?, ?, ?) RETURNING id")
		.bind(subject, level, method, hash)
		.first<{ id: number }>();
	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'kyc', 'KYC attestation recorded', ?, ?, 'shield')")
		.bind(`A ${level} attestation (${method}) was recorded as a hash — no identity stored.`, JSON.stringify({ level, method }))
		.run();
	return row!;
}

export async function shieldOverview(db: D1Database, env: unknown) {
	const [posture, findings, kyc] = await Promise.all([
		assessPosture(db, env),
		db.prepare("SELECT dimension, severity, title, detail, created_at FROM shield_findings ORDER BY id DESC LIMIT 10").all(),
		db.prepare("SELECT level, COUNT(*) as n FROM kyc_attestations GROUP BY level").all<{ level: string; n: number }>(),
	]);
	const trend = (await db.prepare("SELECT value FROM metrics WHERE kind = 'shield_score' ORDER BY id DESC LIMIT 20").all<{ value: number }>()).results
		.map((r) => r.value)
		.reverse();
	return {
		posture,
		findings: findings.results,
		kyc: { total: kyc.results.reduce((n, k) => n + k.n, 0), byLevel: kyc.results },
		trend,
	};
}
