// The Aura layer: turn a personality profile into concrete design data so
// Lumi's work is personalized to the person it's for. Archetypes are the
// classic four working styles; explicit traits always override the archetype.

export const AURA_KINDS = ["client", "brand", "user", "investor", "partner"] as const;

export interface AuraBriefData {
	archetype: string;
	tone: string;
	detailLevel: string;
	pacing: string;
	palette: string;
	riskFraming: string;
}

const ARCHETYPES: Record<string, AuraBriefData> = {
	analytical: {
		archetype: "analytical",
		tone: "precise and evidence-first — lead with the numbers",
		detailLevel: "high: methodology, sources, error bars",
		pacing: "measured; give time to verify claims",
		palette: "cool and restrained — blues, grays, one accent",
		riskFraming: "probabilities and drawdowns, never hype",
	},
	driver: {
		archetype: "driver",
		tone: "direct and outcome-first — lead with the result",
		detailLevel: "low: headline, three bullets, next action",
		pacing: "fast; decisions over deliberation",
		palette: "high-contrast and bold — dark surfaces, strong accent",
		riskFraming: "upside vs downside in one line each",
	},
	expressive: {
		archetype: "expressive",
		tone: "energetic and story-driven — lead with the vision",
		detailLevel: "medium: narrative arc with vivid highlights",
		pacing: "lively; momentum matters",
		palette: "warm and vibrant — saturated accents, motion",
		riskFraming: "the journey framing: setbacks as chapters",
	},
	amiable: {
		archetype: "amiable",
		tone: "warm and reassuring — lead with stability",
		detailLevel: "medium: plain language, no jargon",
		pacing: "gentle; no pressure tactics",
		palette: "soft and natural — muted warm neutrals",
		riskFraming: "safety nets first: what protects them",
	},
};

export function composeBrief(personality: string, traits: Record<string, unknown>): AuraBriefData {
	const p = personality.toLowerCase();
	const key = (Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[]).find((k) => p.includes(k)) ?? "analytical";
	const base = ARCHETYPES[key];
	// Explicit traits override the archetype defaults.
	return {
		archetype: base.archetype,
		tone: String(traits.tone ?? base.tone),
		detailLevel: String(traits.detailLevel ?? base.detailLevel),
		pacing: String(traits.pacing ?? base.pacing),
		palette: String(traits.palette ?? base.palette),
		riskFraming: String(traits.riskFraming ?? base.riskFraming),
	};
}
