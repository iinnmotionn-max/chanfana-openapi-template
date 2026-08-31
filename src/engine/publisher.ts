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
