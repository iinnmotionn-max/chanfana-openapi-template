import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

describe("Orchestrator — Lumi commands every agent & model", () => {
	it("lists the full roster: internal agents ready, Claude honestly offline without a key", async () => {
		const res = await get("/orchestrator");
		expect(res.status).toBe(200);
		const roster = res.body.result.roster;
		for (const name of ["lumi", "reg", "observer", "guardian", "aether", "shield", "growth"]) {
			const agent = roster.find((i: any) => i.name === name);
			expect(agent, `${name} on roster`).toBeTruthy();
			expect(agent.kind).toBe("agent");
			expect(agent.status).toBe("ready");
		}
		const claude = roster.find((i: any) => i.name === "claude");
		expect(claude.kind).toBe("model");
		// No ANTHROPIC_API_KEY in the test env → honestly offline, never faked.
		expect(claude.status).toBe("offline");
		expect(claude.detail).toContain("ANTHROPIC_API_KEY");
		const hf = roster.find((i: any) => i.name === "huggingface");
		expect(hf.kind).toBe("model");
		expect(hf.status).toBe("offline");
		expect(hf.detail).toContain("HF_TOKEN");
	});

	it("dispatching to reg runs a REAL trading cycle and logs the task", async () => {
		await post("/colony/seed");
		const res = await post("/orchestrator/dispatch", { target: "reg", directive: "run a cycle" });
		expect(res.status).toBe(200);
		expect(res.body.result.status).toBe("done");
		expect(res.body.result.result).toContain("traded 200 ticks");

		// The trade actually happened — the market advanced.
		const overview = await get("/analytics/overview");
		expect(overview.body.result.colony.tick).toBeGreaterThan(0);

		// And the order is in the command log.
		const orch = await get("/orchestrator");
		const task = orch.body.result.tasks.find((t: any) => t.target === "reg");
		expect(task).toBeTruthy();
		expect(task.directive).toBe("run a cycle");
		expect(task.status).toBe("done");
	});

	it("dispatching to guardian and shield runs their real actions", async () => {
		await post("/colony/seed");
		const sweep = await post("/orchestrator/dispatch", { target: "guardian", directive: "sweep the house" });
		expect(sweep.body.result.status).toBe("done");
		const scan = await post("/orchestrator/dispatch", { target: "shield", directive: "scan posture" });
		expect(scan.body.result.result).toMatch(/posture \d+\/100/);
	});

	it("dispatching to Claude without a key reports offline — no fabricated counsel", async () => {
		const res = await post("/orchestrator/dispatch", { target: "claude", directive: "advise on risk" });
		expect(res.status).toBe(200);
		expect(res.body.result.status).toBe("offline");
		expect(res.body.result.result).toContain("ANTHROPIC_API_KEY");
		// Nothing was banked as knowledge — no fake counsel in the Databank.
		const knowledge = await get("/knowledge");
		expect(knowledge.body.result.some((k: any) => k.source === "claude")).toBe(false);
	});

	it("dispatching to Hugging Face without a token reports offline — same honesty", async () => {
		const res = await post("/orchestrator/dispatch", { target: "huggingface", directive: "advise on strategy" });
		expect(res.status).toBe(200);
		expect(res.body.result.status).toBe("offline");
		expect(res.body.result.result).toContain("HF_TOKEN");
		const knowledge = await get("/knowledge");
		expect(knowledge.body.result.some((k: any) => k.source === "huggingface")).toBe(false);
	});

	it("rejects an unknown intelligence with 400", async () => {
		const res = await post("/orchestrator/dispatch", { target: "skynet", directive: "do things" });
		expect(res.status).toBe(400);
	});

	it("the analytics overview carries the orchestrator for the cockpit", async () => {
		const res = await get("/analytics/overview");
		expect(res.status).toBe(200);
		const o = res.body.result.orchestrator;
		expect(o.roster.length).toBeGreaterThanOrEqual(9);
		expect(o.roster.filter((i: any) => i.kind === "model").length).toBeGreaterThanOrEqual(2);
		expect(o.roster.some((i: any) => i.kind === "model")).toBe(true);
	});
});
