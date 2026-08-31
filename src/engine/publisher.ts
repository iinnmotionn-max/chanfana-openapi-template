// THE PUBLISHER — the one place a post actually leaves the system.
//
// The old publishPost() set `posted: true` immediately after a commented-out
// fetch. So with credentials configured it reported "posted to x" while
// nothing had left the Worker. That is the exact failure this project keeps
// finding: a task reported complete that never ran.
//
// This module makes `posted` mean one thing only: a real HTTP request to the
// platform returned success. Every other outcome — no adapter for this
// platform yet, a missing extra credential, a non-2xx response, a blocked
// network — is reported honestly and leaves `posted` false. Lumi says a post
// went out only when one did.
//
// A platform without a real adapter is NOT a failure and NOT a fake success:
// it is "ready to post, no delivery route wired", which is the truth.

export interface Delivery {
	posted: boolean; // true ONLY if a real request to the platform succeeded
	adapter: "live" | "none"; // whether a real delivery route exists for this platform
	detail: string;
}

function envStr(env: unknown, key: string): string | null {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" && v.length > 0 ? v : null;
}

// Per-platform delivery. Each adapter makes a REAL request and returns the
// real outcome; it never assumes success. Platforms with no adapter say so.
const ADAPTERS: Record<string, (text: string, env: unknown) => Promise<Delivery>> = {
	// X / Twitter API v2: POST /2/tweets with a bearer token and {text}.
	x: async (text, env) => {
		const token = envStr(env, "X_TOKEN");
		if (!token) return { posted: false, adapter: "live", detail: "X_TOKEN not set" };
		try {
			const res = await fetch("https://api.twitter.com/2/tweets", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify({ text: text.slice(0, 280) }),
			});
			if (res.ok) {
				const body = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
				return { posted: true, adapter: "live", detail: `posted to X${body?.data?.id ? ` (id ${body.data.id})` : ""}` };
			}
			return { posted: false, adapter: "live", detail: `X API returned ${res.status} — not posted` };
		} catch (err) {
			return { posted: false, adapter: "live", detail: `X unreachable — not posted (${String(err).slice(0, 80)})` };
		}
	},

	// LinkedIn UGC posts need the author URN as well as the token; without it a
	// real call cannot even be formed, so we say that rather than pretend.
	linkedin: async (text, env) => {
		const token = envStr(env, "LINKEDIN_TOKEN");
		const author = envStr(env, "LINKEDIN_AUTHOR_URN");
		if (!token) return { posted: false, adapter: "live", detail: "LINKEDIN_TOKEN not set" };
		if (!author) return { posted: false, adapter: "live", detail: "LINKEDIN_AUTHOR_URN not set — needed to attribute the post" };
		try {
			const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
				body: JSON.stringify({
					author,
					lifecycleState: "PUBLISHED",
					specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: text.slice(0, 3000) }, shareMediaCategory: "NONE" } },
					visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
				}),
			});
			if (res.ok) return { posted: true, adapter: "live", detail: "posted to LinkedIn" };
			return { posted: false, adapter: "live", detail: `LinkedIn API returned ${res.status} — not posted` };
		} catch (err) {
			return { posted: false, adapter: "live", detail: `LinkedIn unreachable — not posted (${String(err).slice(0, 80)})` };
		}
	},
};

// Deliver a post to its platform. Returns the honest outcome: `posted` is true
// only when a real request succeeded.
export async function deliver(platform: string, text: string, env: unknown): Promise<Delivery> {
	const adapter = ADAPTERS[platform];
	if (!adapter) {
		// Instagram has no simple text-post API; "blog" is not an external
		// network. These are ready-to-post, not failures, and not fake successes.
		return {
			posted: false,
			adapter: "none",
			detail: `No delivery route for ${platform} yet — the draft is ready, but nothing is auto-posted here.`,
		};
	}
	return adapter(text, env);
}

// ---- Unattended publishing: the `publish` authority scope, made real ----
//
// The publish scope was scored by Shield but enforced nothing. This is what it
// grants: on the hourly pulse, Lumi may send the creator's QUEUED posts to live
// connectors. Three locks, all required:
//
//   1. The `publish` scope is granted (default: revoked).
//   2. The post is 'queued' — the creator marked it ready to go. Drafts are
//      never auto-published; a human approves each one by queuing it.
//   3. The platform's connector is live (its *_TOKEN is set and connected).
//
// A post that cannot go out stays queued and is reported. `posted` never lies.

export interface AutoPublishResult {
	published: number;
	attempted: number;
	skipped: string;
	posts: { id: number; platform: string; posted: boolean; note: string }[];
}

export async function publishQueued(db: D1Database, env: unknown, max = 3): Promise<AutoPublishResult> {
	// Lock 1: the scope. Without it, this is a no-op — Lumi publishes nothing
	// unattended, exactly like every other guarded power.
	const grant = await db.prepare("SELECT granted FROM authority WHERE scope = 'publish'").first<{ granted: number }>();
	if (grant?.granted !== 1) {
		return { published: 0, attempted: 0, skipped: "publish scope not granted — queued posts wait for review", posts: [] };
	}

	// Lock 2: only queued posts, oldest first.
	const queued = (
		await db
			.prepare("SELECT p.id, p.platform, p.title, p.body, c.status AS connector_status FROM posts p LEFT JOIN connectors c ON c.platform = p.platform WHERE p.status = 'queued' ORDER BY p.id LIMIT ?")
			.bind(max)
			.all<{ id: number; platform: string; title: string; body: string; connector_status: string | null }>()
	).results;

	const posts: AutoPublishResult["posts"] = [];
	let published = 0;

	for (const q of queued) {
		// Lock 3: a live connector, or it stays queued and says why. "Live" =
		// the platform's token is set AND the connector row is connected.
		const live = envStr(env, `${q.platform.toUpperCase()}_TOKEN`) !== null && q.connector_status === "connected";
		if (!live) {
			posts.push({ id: q.id, platform: q.platform, posted: false, note: `${q.platform} connector not live — kept queued` });
			continue;
		}
		const d = await deliver(q.platform, q.body || q.title, env);
		if (d.posted) {
			await db.prepare("UPDATE posts SET status = 'published' WHERE id = ?").bind(q.id).run();
			published++;
		}
		posts.push({ id: q.id, platform: q.platform, posted: d.posted, note: d.detail });
	}

	if (published > 0) {
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('growth', 'content', ?, ?, ?, 'growth')")
			.bind(`Auto-published ${published} post(s)`, posts.filter((p) => p.posted).map((p) => `${p.platform}: ${p.note}`).join("\n"), JSON.stringify(posts))
			.run();
	}

	return {
		published,
		attempted: queued.length,
		skipped: queued.length === 0 ? "no queued posts" : "",
		posts,
	};
}
