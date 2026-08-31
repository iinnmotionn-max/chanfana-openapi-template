// THE RED-TEAM PROBE — proving the guards are real, not declared.
//
// policy.ts says which routes need the creator key. A table saying "guarded"
// while the handler forgot the guard is precisely the bug this codebase has
// now shipped twice. So this doesn't read the table and trust it: it attacks
// the running Worker, anonymously, and demands a refusal from every route that
// claims to be locked.
//
// SAFETY — this fires real requests at a live system, so it must be incapable
// of doing damage even when a guard IS missing:
//
//   * It sends an EMPTY body. A guarded route refuses before parsing (the
//     guard is the first statement in every handler). An unguarded route hits
//     schema validation and returns 400 with nothing executed. There is no
//     body here that could move value if it got through.
//   * Because of that ordering, 400 is itself a FAILURE: it means the request
//     reached validation, so either there is no guard or it runs too late.
//     "Validated first, authorized second" is how authorization gets skipped.
//   * It probes only the `creator` list — never /integrity/*, so it cannot
//     recurse into itself.

import { CREATOR_ROUTES } from "./policy";
import { selfFetch } from "./selfref";

export interface ProbeResult {
	route: string;
	status: number;
	guarded: boolean;
	note: string;
}

export interface ProbeReport {
	ok: boolean;
	probed: number;
	holes: ProbeResult[];
	results: ProbeResult[];
}

// A concrete path to hit for a route pattern — ":id" needs a real-looking value.
function concretePath(route: string): { method: string; path: string } {
	const [method, pattern] = route.split(" ");
	return { method, path: pattern.replace(/:[a-zA-Z]+/g, "1") };
}

export async function probeGuards(baseUrl: string, env: unknown): Promise<ProbeReport> {
	const results: ProbeResult[] = [];

	for (const p of CREATOR_ROUTES) {
		const { method, path } = concretePath(p.route);
		let status = 0;
		let note = "";
		try {
			const res = await selfFetch(
				new Request(new URL(path, baseUrl).toString(), {
					method,
					headers: { "Content-Type": "application/json" },
					body: "{}",
				}),
				env,
			);
			status = res.status;
		} catch (err) {
			// A probe that cannot run has not proved anything. Say that, rather
			// than counting an unreachable route as safe.
			results.push({ route: p.route, status: 0, guarded: false, note: `probe could not reach the route: ${String(err).slice(0, 120)}` });
			continue;
		}

		// 401 wrong/absent key · 403 needs the key · 503 no key configured, so
		// the power is unavailable to everyone. All three are refusals.
		const guarded = status === 401 || status === 403 || status === 503;
		if (guarded) note = `refused anonymous caller (${status})`;
		else if (status === 400) note = "reached schema validation before any key check — the guard is missing or runs after parsing";
		else note = `answered an anonymous caller with ${status} — this route is NOT guarded`;

		results.push({ route: p.route, status, guarded, note });
	}

	const holes = results.filter((r) => !r.guarded);
	return { ok: holes.length === 0, probed: results.length, holes, results };
}
