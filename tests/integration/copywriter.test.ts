import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { numeralsIn, unsourcedNumerals } from "../../src/engine/copywriter";

// Handing the fact set to a model buys range. It also buys the one failure mode
// that matters on this feed: a model writing about financial performance will
// eventually produce a number nobody gave it — round it up, invent a
// comparison, add a percentage that reads well. On a feed whose whole claim is
// "every number comes from a row", one fabricated figure destroys the point.
//
// So the model chooses every word and not one fact. These tests are the gate.

const FACTS = 'Paper capital up 6.1%. 1435 closed trades, 36.5% win rate, 10941 from 10000 starting.';

describe("Copywriter gate — the model picks words, never facts", () => {
	it("finds every numeral, normalising separators and trailing zeros", () => {
		expect(numeralsIn("10,941 and 6.10%")).toContain("10941");
		expect(numeralsIn("10,941 and 6.10%")).toContain("6.1");
	});

	it("passes copy that only uses the numbers it was given", () => {
		const ok = "Paper capital is up 6.1% across 1435 closed trades. Win rate 36.5%.";
		expect(unsourcedNumerals(ok, FACTS)).toEqual([]);
	});

	it("CATCHES a figure that appears from nowhere — the whole point", () => {
		const invented = "Paper capital up 6.1%, on track for 40% annualised.";
		expect(unsourcedNumerals(invented, FACTS)).toContain("40");
	});

	it("catches a plausible-looking fabrication next to real numbers", () => {
		// The dangerous case is not an obvious lie, it is one true number
		// carrying an invented one that reads just as confidently.
		const mixed = "1435 closed trades, 36.5% win rate, and a 2.8 Sharpe ratio.";
		expect(unsourcedNumerals(mixed, FACTS)).toEqual(["2.8"]);
	});

	it("allows an honest rounding of a source figure", () => {
		expect(unsourcedNumerals("Paper capital up about 6%.", FACTS)).toEqual([]);
	});

	it("does not trip over ordinary small integers in prose", () => {
		// "3 rules", "2 things" — treating these as claims would reject every
		// readable sentence and make the gate useless by being unusable.
		expect(unsourcedNumerals("There are 3 rules behind this. Two matter most.", FACTS)).toEqual([]);
	});

	it("falls back to the template when Claude is not linked, and says so", async () => {
		// ANTHROPIC_API_KEY is unbound in tests: the honest path is a template
		// post plus a note, never a skipped post.
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		for (let i = 0; i < 4; i++) {
			await SELF.fetch("http://local.test/engine/run", {
				method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticks: 400, learn: true }),
			});
		}
		const r = ((await (await SELF.fetch("http://local.test/growth/newsroom", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max: 2 }),
		})).json()) as any).result;

		expect(r.drafted).toBeGreaterThan(0);
		for (const p of r.posts) {
			expect(p.writer).toBe("template");
			expect(p.note).toContain("ANTHROPIC_API_KEY");
			// And it states that the facts do not change with the writer.
			expect(p.note).toContain("Facts are identical");
		}
	});

	it("records WHICH writer produced each post, so it is never a guess", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		for (let i = 0; i < 4; i++) {
			await SELF.fetch("http://local.test/engine/run", {
				method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticks: 400, learn: true }),
			});
		}
		await SELF.fetch("http://local.test/growth/newsroom", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max: 2 }),
		});
		const rows = ((await (await SELF.fetch("http://local.test/growth/posts")).json()) as any).result;
		const list = Array.isArray(rows) ? rows : rows.posts;
		const drafted = list.filter((p: any) => p.writer);
		expect(drafted.length).toBeGreaterThan(0);
		for (const p of drafted) expect(["claude", "template"]).toContain(p.writer);
	});
});
