import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Drafting used four fixed templates with a topic word swapped in. On an hourly
// schedule that is the same four posts forever — fluent, confident, carrying no
// information. A feed like that is worse than silence: it trains people to skip
// you. These tests are mostly about the restraint, not the copy.

async function post(path: string, body: unknown = {}) {
	const r = await SELF.fetch(`http://local.test${path}`, {
		method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
	});
	return (await r.json()) as any;
}
async function busyColony() {
	await post("/colony/seed");
	for (let i = 0; i < 6; i++) await post("/engine/run", { ticks: 400, learn: true });
}
async function drafts() {
	return (await env.DB.prepare("SELECT platform, title, body, event_key FROM posts WHERE event_key != '' ORDER BY id").all<any>()).results;
}

describe("Newsroom — hourly posts made of facts", () => {
	it("drafts from real recorded events, quoting real numbers", async () => {
		await busyColony();
		const r = await post("/growth/newsroom", { max: 3 });
		expect(r.result.drafted).toBeGreaterThan(0);

		const rows = await drafts();
		// Every draft must contain a digit — a post about a system with no number
		// in it is the template problem wearing a new coat.
		for (const d of rows) expect(/\d/.test(d.body), `no figures in: ${d.title}`).toBe(true);
	});

	it("NEVER drafts the same event twice, however many times it runs", async () => {
		await busyColony();
		const first = await post("/growth/newsroom", { max: 6 });
		expect(first.result.drafted).toBeGreaterThan(0);

		const second = await post("/growth/newsroom", { max: 6 });
		expect(second.result.drafted, "everything was already covered").toBe(0);
		expect(second.result.skipped).toBeGreaterThan(0);

		const keys = (await drafts()).map((d: any) => d.event_key);
		expect(new Set(keys).size, "duplicate event keys").toBe(keys.length);
	});

	it("stays SILENT when there is nothing new to say", async () => {
		await busyColony();
		await post("/growth/newsroom", { max: 6 });
		const quiet = await post("/growth/newsroom", { max: 6 });
		expect(quiet.result.drafted).toBe(0);
		// And says why, rather than reporting a successful no-op.
		expect(quiet.result.note).toContain("Nothing new to say");
		expect(quiet.result.note).toContain("starts inventing");
	});

	it("runs on the hourly pulse and reports what it did", async () => {
		await busyColony();
		const r = await post("/lumi/pulse");
		const line = r.result.decisions.find((d: string) => d.includes("drafted") || d.includes("Nothing new to say"));
		expect(line, "the pulse accounts for its drafting either way").toBeTruthy();
	});

	it("leads with the story that reflects worst on the system", async () => {
		// A retirement — "we killed a strategy that was right 58% of the time" —
		// outranks every flattering milestone. A build-in-public feed that only
		// surfaces good news is marketing wearing an engineer's jacket.
		await busyColony();
		const r = await (await SELF.fetch("http://local.test/growth/newsroom")).json() as any;
		const events = r.result.events;
		if (events.some((e: any) => e.kind === "retirement")) {
			expect(events[0].kind, "the retirement should lead").toBe("retirement");
		}
	});

	it("every draft stays a DRAFT — nothing reaches an audience by itself", async () => {
		await busyColony();
		await post("/growth/newsroom", { max: 6 });
		const statuses = (await env.DB.prepare("SELECT DISTINCT status FROM posts WHERE event_key != ''").all<{ status: string }>()).results;
		expect(statuses.map((s) => s.status)).toEqual(["draft"]);
	});

	it("varies platform instead of repeating one voice", async () => {
		await busyColony();
		await post("/growth/newsroom", { max: 6 });
		const platforms = new Set((await drafts()).map((d: any) => d.platform));
		expect(platforms.size, "a single-platform feed is the old problem again").toBeGreaterThan(1);
	});

	it("says plainly what is paper trading, in the copy itself", async () => {
		await busyColony();
		await post("/growth/newsroom", { max: 6 });
		const milestone = (await drafts()).find((d: any) => d.event_key.startsWith("milestone:"));
		if (milestone) {
			expect(milestone.body, "a returns post must not imply real money").toContain("no broker");
		}
	});
});
