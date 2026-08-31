import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// GET /analytics/overview is the cockpit's hot path: one open dashboard tab
// calls it every 8 seconds, forever. Over this session I added a DB-backed
// computation to that payload almost every time I touched it — integrity,
// callers, readiness, provenance, automation — and never once looked at what
// the whole thing costs.
//
// It costs ~90 queries per poll. That is survivable, and it is exactly the
// kind of number that doubles quietly: each addition looks free on its own and
// nobody ever measures the total. On local D1 (a file) it is invisible; on
// remote D1 every query is a network hop, and one tab left open is ~11
// queries/second sustained.
//
// So the budget is written down and enforced. Raising it should be a decision
// someone makes on purpose, in a diff, not something that happens to them.

const QUERY_BUDGET = 110;

async function countQueries(fn: () => Promise<unknown>): Promise<number> {
	const db = env.DB as unknown as { prepare: (sql: string) => unknown };
	const orig = db.prepare.bind(db);
	let n = 0;
	db.prepare = (sql: string) => {
		n++;
		return orig(sql);
	};
	try {
		await fn();
	} finally {
		db.prepare = orig;
	}
	return n;
}

describe("Hot path — what one cockpit poll actually costs", () => {
	it("stays inside its query budget", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		const n = await countQueries(() => SELF.fetch("http://local.test/analytics/overview"));
		expect(
			n,
			`One cockpit poll issued ${n} queries (budget ${QUERY_BUDGET}). If this is a deliberate addition, raise the budget in this test and say why. If not, batch it or move it off the 8-second poll.`,
		).toBeLessThanOrEqual(QUERY_BUDGET);
	});

	it("does not grow with the size of the colony", async () => {
		// A per-row query hidden in a loop is the classic way a payload goes from
		// fine to unusable as real data accumulates — and it looks perfect on a
		// fresh install, which is where it always gets reviewed.
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		const small = await countQueries(() => SELF.fetch("http://local.test/analytics/overview"));

		await SELF.fetch("http://local.test/engine/run", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ticks: 600, learn: true }),
		});
		const big = await countQueries(() => SELF.fetch("http://local.test/analytics/overview"));

		expect(big, `queries went ${small} → ${big} after 600 ticks of trading — something is querying per row`).toBeLessThanOrEqual(small + 5);
	});

	it("reads are cheap for the things polled most often", async () => {
		for (const [path, budget] of [
			["/ready", 1],
			["/bridges", 4],
			["/integrity", 20],
		] as const) {
			const n = await countQueries(() => SELF.fetch(`http://local.test${path}`));
			expect(n, `${path} issued ${n} queries (budget ${budget})`).toBeLessThanOrEqual(budget);
		}
	});
});
