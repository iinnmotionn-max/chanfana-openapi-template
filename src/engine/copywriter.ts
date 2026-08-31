// CLAUDE WRITES THE COPY — but the facts stay locked.
//
// The template writer is specific and true and always sounds the same. Handing
// the same fact set to a model buys range. It also buys the one failure mode
// that actually matters here: a model writing marketing copy about financial
// performance will, sooner or later, produce a number nobody gave it. Round it
// up, invent a comparison, add a percentage that reads well. On a feed whose
// entire claim is "every number comes from a row", one fabricated figure
// destroys the thing the feed was for.
//
// So the model gets the facts and the framing job, and NOTHING it writes is
// trusted on the way out:
//
//   * every numeral in the generated copy must already appear in the facts it
//     was given — a figure with no source is a rejection, not an edit;
//   * the caveat that has to survive (paper trading, no broker) is checked for
//     explicitly, because that is the sentence a copywriter naturally cuts;
//   * anything rejected falls back to the template, and the post records WHICH
//     writer produced it, so nobody has to guess later.
//
// The result: the model can choose every word and cannot choose a single fact.

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./orchestrator";
import type { NewsEvent, Platform } from "./newsroom";

export interface WrittenCopy {
	title: string;
	body: string;
	writer: "claude" | "template";
	note: string;
}

function envStr(env: unknown, key: string): string {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" ? v : "";
}

// Every distinct numeral in a string, normalised so 6.10 and 6.1 compare equal
// and thousands separators do not create phantom mismatches.
export function numeralsIn(text: string): string[] {
	const out = new Set<string>();
	for (const m of text.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)) {
		const n = Number(m[0]);
		if (Number.isFinite(n)) out.add(String(n));
	}
	return [...out];
}

// Does this copy invent anything? Returns the numerals that have no source.
//
// Rounding is allowed in one direction only: a figure the model rounded from a
// source number is fine (6.1 from 6.14), a figure that appears from nowhere is
// not. Single digits are exempt — they are almost always list positions, "3
// rules", or part of a word like 4:5, and treating them as claims would reject
// every readable sentence.
export function unsourcedNumerals(copy: string, facts: string): string[] {
	const sourced = numeralsIn(facts).map(Number);
	return numeralsIn(copy).filter((token) => {
		const v = Number(token);
		if (v < 10 && Number.isInteger(v)) return false; // list positions, not claims
		const hasSource = sourced.some((s) => s === v || Math.abs(s - v) < 0.05 || Math.round(s) === v);
		return !hasSource;
	});
}

const VOICE: Record<Platform, string> = {
	x: "A short post for X. Punchy, one idea, no thread. Under 250 characters before hashtags.",
	linkedin: "A LinkedIn post. Plain professional prose, no bullet lists, no emoji, 100-150 words.",
	instagram: "An Instagram caption. Warm and human, a little wonder, emoji sparingly, 60-100 words.",
	blog: "A short blog section in markdown with an H2 heading. 150-220 words.",
};

export async function writeWithClaude(
	e: NewsEvent,
	platform: Platform,
	env: unknown,
	fallback: { title: string; body: string },
): Promise<WrittenCopy> {
	const apiKey = envStr(env, "ANTHROPIC_API_KEY");
	if (!apiKey) {
		return { ...fallback, writer: "template", note: "Claude not linked — set ANTHROPIC_API_KEY for varied copy. Facts are identical either way." };
	}

	const facts = `${e.headline}\n${e.facts}\n${e.angle}`;
	try {
		const client = new Anthropic({ apiKey });
		const res = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 1024,
			system:
				"You write build-in-public posts for Lumi, an autonomous system that runs a PAPER-trading colony " +
				"(no broker, no real money), a fixed-supply in-app token, a security scanner and a Roblox city.\n\n" +
				"HARD RULES:\n" +
				"- Use ONLY the facts given. Never introduce a number, percentage, date or comparison that is not in them.\n" +
				"- Never imply real money, real trading, or investment advice. If returns are mentioned, say plainly it is paper trading with no broker connected.\n" +
				"- No hype words: revolutionary, game-changing, unprecedented, insane.\n" +
				"- Write the post only. No preamble, no explanation, no options.",
			messages: [
				{
					role: "user",
					content: `${VOICE[platform]}\n\nFacts you may use (and nothing else):\n\n${facts}`,
				},
			],
		});
		const text = res.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text)
			.join("\n")
			.trim();

		if (!text) return { ...fallback, writer: "template", note: "Claude returned nothing; used the template." };

		// --- The gate. Nothing below is a style opinion; each is a fact claim.
		const invented = unsourcedNumerals(text, facts);
		if (invented.length > 0) {
			return {
				...fallback,
				writer: "template",
				note: `Claude's draft was rejected: it contained figure(s) with no source (${invented.join(", ")}). Used the template instead.`,
			};
		}
		if (/\b(guaranteed|risk-free|profit you can|financial advice)\b/i.test(text)) {
			return { ...fallback, writer: "template", note: "Claude's draft was rejected: it implied a promise about returns. Used the template instead." };
		}
		// A returns post must carry its own caveat — that is the line a
		// copywriter cuts first, and the one that must not go.
		if (e.kind === "milestone" && !/paper|no broker|simulated/i.test(text)) {
			return { ...fallback, writer: "template", note: "Claude's draft was rejected: a returns post that did not say it was paper trading. Used the template instead." };
		}

		return { title: e.headline, body: text, writer: "claude", note: "Written by Claude from the recorded facts; every figure checked against them." };
	} catch (err) {
		const msg = err instanceof Anthropic.APIError ? `Anthropic API error ${err.status}` : "Claude unreachable";
		return { ...fallback, writer: "template", note: `${msg} — used the template. Nothing was skipped.` };
	}
}
