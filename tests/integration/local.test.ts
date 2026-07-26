import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// These suites exercise Lumi's AUTHORITY model — what she may do once a scope
// is granted. Granting a consequential scope now needs the creator key, so
// every request here speaks as the creator. The lock itself is what
// creator.test.ts tests; here it would only be noise.
const CREATOR_KEY = "test-creator-key";

async function post(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function patch(path: string, body: unknown = {}) {
	const res = await SELF.fetch(`http://local.test${path}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: (await res.json()) as any };
}
async function get(path: string) {
	const res = await SELF.fetch(`http://local.test${path}`);
	return { status: res.status, body: (await res.json()) as any };
}

// Matches tests/vitest.config.mts. In production the bridge is off until the
// operator sets LOCAL_AGENT_SECRET (503 path, guarded in code).
const SECRET = "test-agent-secret";

describe("Local agent — Lumi's hands on the creator's machine", () => {
	it("reports the bridge status honestly", async () => {
		const res = await get("/local");
		expect(res.status).toBe(200);
		expect(res.body.result.linked).toBe(true); // secret bound in the test env
		expect(res.body.result).toHaveProperty("pending");
	});

	it("refuses to queue machine work until the creator grants the scope", async () => {
		const refused = await post("/command", { order: "on my machine: git status" });
		expect(refused.body.result.status).toBe("refused");
		expect(refused.body.result.scope).toBe("machine");

		// Nothing was queued.
		const before = await get("/local");
		expect(before.body.result.pending).toBe(0);
	});

	it("queues a task once granted, and the agent claims exactly one at a time", async () => {
		await patch("/command/authority", { scope: "machine", granted: true });

		const queued = await post("/command", { order: "on my machine: git status" });
		expect(queued.body.result.status).toBe("done");
		expect(queued.body.result.result).toContain("queued for your machine");

		// The agent claims it.
		const claim = await post("/local/next", { secret: SECRET, host: "test-box" });
		expect(claim.status).toBe(200);
		expect(claim.body.result.task).toBe("git status");
		expect(claim.body.result.status).toBe("claimed");
		expect(claim.body.result.host).toBe("test-box");

		// Queue is now empty — a claimed task is never handed out twice.
		const again = await post("/local/next", { secret: SECRET, host: "test-box" });
		expect(again.body.result).toBeNull();
	});

	it("records a refusal from the machine as a first-class outcome", async () => {
		await patch("/command/authority", { scope: "machine", granted: true });
		await post("/command", { order: "on my machine: rm -rf /" });
		const claim = await post("/local/next", { secret: SECRET, host: "test-box" });

		const done = await post("/local/result", {
			secret: SECRET,
			id: claim.body.result.id,
			status: "refused",
			result: 'Refused: "rm" is not on the allowlist.',
		});
		expect(done.status).toBe(200);
		expect(done.body.result.status).toBe("refused");
		expect(done.body.result.result).toContain("not on the allowlist");

		const status = await get("/local");
		expect(status.body.result.tasks[0].status).toBe("refused");
	});

	it("a task can only be completed ONCE, and only after it is claimed", async () => {
		await patch("/command/authority", { scope: "machine", granted: true });
		await post("/command", { order: "on my machine: git status" });

		// Reporting on a task nobody has claimed would mark a command as run
		// when nothing ever ran it.
		const queued = await get("/local");
		const id = queued.body.result.tasks.find((t: any) => t.status === "queued").id;
		const premature = await post("/local/result", { secret: SECRET, id, status: "done", result: "never ran" });
		expect(premature.status).toBe(400);
		expect(premature.body.errors[0].message).toContain("not claimed");

		// Claim it, report once — fine.
		await post("/local/next", { secret: SECRET, host: "box-a" });
		const first = await post("/local/result", { secret: SECRET, id, status: "done", result: "clean" });
		expect(first.status).toBe(200);

		// A second report must not overwrite the real outcome.
		const second = await post("/local/result", { secret: SECRET, id, status: "failed", result: "forged" });
		expect(second.status).toBe(400);
		const after = await get("/local");
		const task = after.body.result.tasks.find((t: any) => t.id === id);
		expect(task.status).toBe("done");
		expect(task.result).toBe("clean");
	});

	it("records a completed task with its output", async () => {
		await patch("/command/authority", { scope: "machine", granted: true });
		await post("/command", { order: "on my machine: node --version" });
		const claim = await post("/local/next", { secret: SECRET, host: "test-box" });
		const done = await post("/local/result", { secret: SECRET, id: claim.body.result.id, status: "done", result: "v22.0.0" });
		expect(done.body.result.status).toBe("done");
		expect(done.body.result.result).toBe("v22.0.0");
	});

	it("rejects a bad agent secret on both polling endpoints", async () => {
		expect((await post("/local/next", { secret: "wrong" })).status).toBe(401);
		expect((await post("/local/result", { secret: "wrong", id: 1, status: "done" })).status).toBe(401);
	});

	it("rejects near-miss secrets too — comparison is length-safe and full-byte", async () => {
		// A prefix, a suffix, and a same-length near miss all fail identically.
		for (const bad of ["test-agent-secre", "test-agent-secret2", "test-agent-secreX"]) {
			expect((await post("/local/next", { secret: bad })).status, bad).toBe(401);
		}
	});

	it("400s when reporting on a task that doesn't exist", async () => {
		const res = await post("/local/result", { secret: SECRET, id: 999999, status: "done", result: "x" });
		expect(res.status).toBe(400);
	});

	it("the analytics overview carries the bridge for the cockpit", async () => {
		const res = await get("/analytics/overview");
		expect(res.body.result.local).toHaveProperty("linked");
		expect(res.body.result.local).toHaveProperty("note");
		// 'machine' is a first-class authority scope.
		expect(res.body.result.command.authority.some((a: any) => a.scope === "machine")).toBe(true);
	});
});
