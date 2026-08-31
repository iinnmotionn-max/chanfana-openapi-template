import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { deliver } from "../../src/engine/publisher";

// The old publish path set `posted: true` right after a commented-out fetch —
// it claimed a post went out while nothing left the Worker. That is a task
// reported complete that never ran, the exact thing this project keeps
// finding. These tests pin down one rule: `posted` is true ONLY when a real
// request to a platform actually succeeded.

const CREATOR_KEY = "test-creator-key";

async function post(path: string, body: unknown = {}) {
	const r = await SELF.fetch(`http://local.test${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Creator-Key": CREATOR_KEY },
		body: JSON.stringify(body),
	});
	return { status: r.status, body: (await r.json()) as any };
}

describe("Publisher — 'posted' means a real post, never a claim", () => {
	it("deliver() to a platform with no adapter is honest: ready, not fake-posted", async () => {
		const d = await deliver("instagram", "hello", {});
		expect(d.posted, "nothing was actually sent").toBe(false);
		expect(d.adapter).toBe("none");
		expect(d.detail).toContain("No delivery route");
	});

	it("deliver() to X without a token does not claim it posted", async () => {
		const d = await deliver("x", "hello", {});
		expect(d.posted).toBe(false);
		expect(d.detail).toContain("X_TOKEN");
	});

	it("LinkedIn refuses to pretend when the author URN is missing", async () => {
		// A LinkedIn UGC post cannot even be formed without the author URN, so we
		// say that rather than mark it posted.
		const d = await deliver("linkedin", "hello", { LINKEDIN_TOKEN: "tok" });
		expect(d.posted).toBe(false);
		expect(d.detail).toContain("LINKEDIN_AUTHOR_URN");
	});

	it("publishing without a live connector marks the post READY, not published", async () => {
		// No X_TOKEN in tests, so nothing can actually go out. The post must not
		// be marked 'published' — that word is reserved for a real post.
		await post("/colony/seed");
		const draft = await env.DB
			.prepare("INSERT INTO posts (platform, kind, title, body, status) VALUES ('x','post','Test','A real body with a number 5.',' draft') RETURNING id")
			.first<{ id: number }>();

		const res = await post(`/growth/post/${draft!.id}/publish`);
		expect(res.status).toBe(200);
		expect(res.body.result.posted, "no token, so nothing was posted").toBe(false);
		expect(res.body.result.status).toBe("ready");
		expect(res.body.result.note).toContain("X_TOKEN");

		// And the row reflects it — not marked published.
		const row = await env.DB.prepare("SELECT status FROM posts WHERE id = ?").bind(draft!.id).first<{ status: string }>();
		expect(row?.status).toBe("ready");
	});

	it("publishing still needs the creator key — it reaches outside the system", async () => {
		await post("/colony/seed");
		const draft = await env.DB
			.prepare("INSERT INTO posts (platform, kind, title, body, status) VALUES ('x','post','T','B',' draft') RETURNING id")
			.first<{ id: number }>();
		const res = await SELF.fetch(`http://local.test/growth/post/${draft!.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
		expect(res.status, "no creator key → refused").toBe(401);
	});
});
