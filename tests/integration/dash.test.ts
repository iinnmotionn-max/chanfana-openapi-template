import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// The cockpit is ~2,200 lines of JavaScript living inside a TypeScript
// template literal. Nothing ever parsed it.
//
// That caught up with this project: a single "\n" inside that template was
// consumed by TypeScript and emitted as a REAL newline inside a JS string
// literal. One character, and the entire script failed to parse — every panel
// blank, the dashboard frozen on "connecting to Reg…". tsc was happy (it is a
// valid string), every one of 192 tests passed (none of them load the page),
// and the API was perfectly healthy the whole time.
//
// A build artifact nobody parses is a build artifact nobody has checked.

async function dashHtml(): Promise<string> {
	const res = await SELF.fetch("http://local.test/dash");
	expect(res.status).toBe(200);
	return await res.text();
}

function scripts(html: string): string[] {
	const out: string[] = [];
	const re = /<script>([\s\S]*?)<\/script>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) out.push(m[1]);
	return out;
}

describe("The cockpit actually parses", () => {
	it("every inline script is syntactically valid JavaScript", async () => {
		const blocks = scripts(await dashHtml());
		expect(blocks.length, "found the cockpit's script").toBeGreaterThan(0);
		for (const [i, code] of blocks.entries()) {
			expect(code.length, `script ${i} is not empty`).toBeGreaterThan(100);
			// Compiling is the check: a syntax error throws here, naming the line.
			// (new Function does not RUN the body — no DOM is touched.)
			expect(() => new Function(code), `script block ${i} must parse`).not.toThrow();
		}
	});

	it("survives the specific mistake that broke it, as a regression guard", async () => {
		// The bug was a raw newline inside a string literal. Rather than a
		// quote-counting heuristic — which flags every apostrophe in a comment
		// and teaches people to ignore it — this proves the parser above is
		// actually capable of catching that shape.
		expect(() => new Function('const s = "a\nb";')).toThrow();
		expect(() => new Function('const s = "a\\nb";')).not.toThrow();
	});

	it("serves a complete document with the panels the renderer expects", async () => {
		const html = await dashHtml();
		expect(html).toContain("</html>");
		// Each of these is a mount point the JS writes into; a rename that
		// silently orphans one shows up as a permanently empty panel.
		for (const id of ["status", "jv-order", "jv-go", "jv-grants", "jv-ready", "jv-callers", "jv-integ-breaks"]) {
			expect(html, `#${id} is present`).toContain(`id="${id}"`);
		}
	});

	it("every source badge has a panel to bind to", async () => {
		const html = await dashHtml();
		const badges = [...html.matchAll(/data-src="([a-z]+)"/g)].map((m) => m[1]);
		expect(badges.length).toBeGreaterThan(10);

		const d = ((await (await SELF.fetch("http://local.test/analytics/overview")).json()) as any).result;
		const known = new Set(d.sources.map((s: any) => s.panel));
		const orphans = [...new Set(badges)].filter((b) => !known.has(b));
		expect(orphans, `badge(s) with no source entry — they would render blank: ${orphans.join(", ")}`).toEqual([]);
	});
});
