// DEPLOYMENT READINESS — what is actually wired, and what to type to fix it.
//
// Everything in this system is honest-by-default: an unconfigured integration
// reports itself offline instead of pretending. That's the right behaviour, but
// spread across a dozen panels it answers "is this thing on?" one component at
// a time and never answers "what do I still have to do?".
//
// This is that missing page. One call, every switch, the exact command.
//
// The one thing it must never do is overstate. A secret being SET is not proof
// it WORKS — a revoked API key looks identical from here. So this reports
// "configured" and says plainly that liveness is a different question, answered
// by the panel that actually calls the service.

export type Need = "required" | "recommended" | "optional";

export interface ReadinessItem {
	name: string;
	envKey: string;
	configured: boolean;
	need: Need;
	unlocks: string;
	command: string;
	note?: string;
}

export interface Readiness {
	deployable: boolean; // nothing REQUIRED is missing
	configured: number;
	total: number;
	items: ReadinessItem[];
	nextStep: string;
	caveat: string;
}

function isSet(env: unknown, key: string): boolean {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" && v.length > 0;
}

const CATALOG: Omit<ReadinessItem, "configured">[] = [
	{
		name: "Creator key",
		envKey: "CREATOR_KEY",
		need: "required",
		unlocks: "Spending, publishing, unattended action, and machine reach — for you and nobody else.",
		command: "npx wrangler secret put CREATOR_KEY",
		note: "Without it those powers are locked for EVERYONE, including you. A deployed Worker URL is not a secret, so this is the one to set before going live.",
	},
	{
		name: "Claude",
		envKey: "ANTHROPIC_API_KEY",
		need: "recommended",
		unlocks: "Counsel and the council chamber. Lumi's own capabilities all work without it.",
		command: "npx wrangler secret put ANTHROPIC_API_KEY",
	},
	{
		name: "Open models",
		envKey: "HF_TOKEN",
		need: "optional",
		unlocks: "Hugging Face inference as a second voice in the council.",
		command: "npx wrangler secret put HF_TOKEN",
	},
	{
		name: "Local agent bridge",
		envKey: "LOCAL_AGENT_SECRET",
		need: "optional",
		unlocks: "Queueing work for your own computer. You still run agent/lumi-agent.mjs and confirm every command.",
		command: "npx wrangler secret put LOCAL_AGENT_SECRET",
	},
	{
		name: "InMotion RP bridge",
		envKey: "RP_SHARED_SECRET",
		need: "optional",
		unlocks: "The Roblox city paying and charging players in conserved AETHER.",
		command: "npx wrangler secret put RP_SHARED_SECRET",
		note: "The same value goes in a ServerStorage StringValue named RP_SHARED_SECRET.",
	},
	{
		name: "X publishing",
		envKey: "X_TOKEN",
		need: "optional",
		unlocks: "Growth posts leaving the system. Until set, they stay local drafts and say so.",
		command: "npx wrangler secret put X_TOKEN",
	},
	{
		name: "LinkedIn publishing",
		envKey: "LINKEDIN_TOKEN",
		need: "optional",
		unlocks: "The same, for LinkedIn.",
		command: "npx wrangler secret put LINKEDIN_TOKEN",
	},
	{
		name: "AETHER on Sui",
		envKey: "AETHER_PACKAGE_ID",
		need: "optional",
		unlocks: "On-chain settlement. The ledger is conserved either way; this makes it verifiable off-system.",
		command: "bash sui/publish.sh   (needs your own gas)",
	},
];

export function assessReadiness(env: unknown): Readiness {
	const items: ReadinessItem[] = CATALOG.map((c) => ({ ...c, configured: isSet(env, c.envKey) }));
	const missingRequired = items.filter((i) => i.need === "required" && !i.configured);
	const missingRecommended = items.filter((i) => i.need === "recommended" && !i.configured);

	const nextStep = missingRequired.length
		? `Set ${missingRequired[0].envKey} — ${missingRequired[0].command}`
		: missingRecommended.length
			? `Everything required is set. Next most useful: ${missingRecommended[0].envKey} — ${missingRecommended[0].command}`
			: "Everything required and recommended is configured. The rest are opt-in.";

	return {
		deployable: missingRequired.length === 0,
		configured: items.filter((i) => i.configured).length,
		total: items.length,
		items,
		nextStep,
		caveat:
			"'Configured' means the value is present, not that it works — a revoked key looks identical from here. Each realm's own panel reports whether its service actually answered.",
	};
}
