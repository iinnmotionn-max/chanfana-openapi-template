import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ROUTE_POLICY, policyFor } from "../../src/engine/policy";

// Both security holes this codebase has shipped were found by a human reading
// the route table. This is that reading, automated: every writing route in
// src/index.ts must be classified in policy.ts, on purpose, in writing.

const SOURCE = (env as unknown as { INDEX_SOURCE: string }).INDEX_SOURCE;

function registeredWritingRoutes(): string[] {
	const out: string[] = [];
	const re = /openapi\.(post|patch|put|delete)\(\s*"([^"]+)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(SOURCE)) !== null) out.push(`${m[1].toUpperCase()} ${m[2]}`);
	return out;
}

describe("Route policy — no writing endpoint escapes classification", () => {
	it("reads the real route table out of src/index.ts", () => {
		const routes = registeredWritingRoutes();
		expect(routes.length, "the source binding actually parsed").toBeGreaterThan(40);
		expect(routes).toContain("POST /aether/transfer");
	});

	it("EVERY registered writing route is classified in policy.ts", () => {
		const unclassified = registeredWritingRoutes().filter((r) => !policyFor(r));
		expect(
			unclassified,
			`Unclassified writing route(s). Add them to ROUTE_POLICY in src/engine/policy.ts with the reason they are open, guarded, or bridge-gated:\n  ${unclassified.join("\n  ")}`,
		).toEqual([]);
	});

	it("the policy does not describe routes that no longer exist", () => {
		// A stale entry is a quiet lie about what the system protects.
		const registered = new Set(registeredWritingRoutes());
		const ghosts = ROUTE_POLICY.map((p) => p.route).filter((r) => !registered.has(r));
		expect(ghosts, `policy entries with no matching route: ${ghosts.join(", ")}`).toEqual([]);
	});

	it("every entry says WHY, so the next reader can judge it", () => {
		for (const p of ROUTE_POLICY) {
			expect(p.why.length, `${p.route} needs a reason`).toBeGreaterThan(10);
		}
	});

	it("anything that moves AETHER is classified creator or bridge — never open", () => {
		// The rule the last two commits were about, stated once as an assertion.
		const valueRoutes = ROUTE_POLICY.filter((p) =>
			/\/aether\/(transfer|reward|spend)|\/wallet\/send|\/defi\//.test(p.route),
		);
		expect(valueRoutes.length).toBeGreaterThan(10);
		for (const p of valueRoutes) {
			expect(p.protection, `${p.route} moves value`).toBe("creator");
		}
	});
});

// The probe: not "does policy.ts claim these are guarded", but "does the
// running Worker actually refuse an anonymous caller on each of them".
describe("Guard probe — attacking our own locked routes", () => {
	it("every route policy calls guarded actually refuses an anonymous caller", async () => {
		const res = await SELF.fetch("http://local.test/integrity/probe", { method: "POST" });
		const report = ((await res.json()) as any).result;
		expect(report.probed).toBeGreaterThan(10);
		expect(
			report.holes.map((h: any) => `${h.route} → ${h.note}`),
			"a route claimed to be guarded answered an anonymous caller",
		).toEqual([]);
		expect(report.ok).toBe(true);
	});

	it("treats a 400 as a HOLE — validating before authorizing is the bug", async () => {
		// Stated as an assertion so the intent survives refactoring: a guard
		// that runs after schema parsing has already let the request in.
		const res = await SELF.fetch("http://local.test/integrity/probe", { method: "POST" });
		const report = ((await res.json()) as any).result;
		for (const r of report.results) {
			expect([401, 403, 503], `${r.route} answered ${r.status}`).toContain(r.status);
		}
	});

	it("records each probe so a hole is chronicled, not just returned", async () => {
		await SELF.fetch("http://local.test/integrity/probe", { method: "POST" });
		const rows = await env.DB.prepare("SELECT COUNT(*) as n FROM checks WHERE name LIKE 'guard:%'").first<{ n: number }>();
		expect(rows?.n).toBeGreaterThan(10);
	});
});
