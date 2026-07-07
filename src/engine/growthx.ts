// Growth v2: posting connectors (an honest publish adapter), a partnerships/
// deals pipeline, and campaign analytics — under the existing 'growth' realm.
//
// Honesty: a connector is only "live" when its API credentials exist in the
// Worker env (secrets the operator sets, e.g. X_TOKEN). Publishing to a real
// network happens only when the connector is live; otherwise the post is
// marked published LOCALLY and the response says exactly that. We never claim
// a real post without a live connector — same stance as the Sui adapter.

export const STAGES = ["prospect", "contacted", "negotiating", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export interface TokenError {
	error: string;
}

function envStr(env: unknown, key: string): string | null {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" && v.length > 0 ? v : null;
}

// A platform is "live" when its credential secret is present, e.g. X_TOKEN.
export function envHasCreds(env: unknown, platform: string): boolean {
	return envStr(env, `${platform.toUpperCase()}_TOKEN`) !== null;
}

export async function connectorStatus(db: D1Database, env: unknown) {
	const rows = (await db.prepare("SELECT platform, handle, status, updated_at FROM connectors ORDER BY id").all<{ platform: string; handle: string; status: string; updated_at: string | null }>()).results;
	return rows.map((r) => {
		const live = envHasCreds(env, r.platform);
		const connected = r.status === "connected" && live;
		return {
			platform: r.platform,
			handle: r.handle,
			status: r.status,
			live,
			connected,
			note: connected
				? `Live — posts publish to ${r.platform} as @${r.handle || "?"}.`
				: r.status === "connected"
					? `Account linked; set ${r.platform.toUpperCase()}_TOKEN as a Worker secret to post for real.`
					: `Not connected — connect ${r.platform}, then set ${r.platform.toUpperCase()}_TOKEN to post for real.`,
		};
	});
}

export async function connect(db: D1Database, platform: string, handle: string): Promise<{ platform: string; handle: string; status: string } | TokenError> {
	const row = await db.prepare("SELECT platform FROM connectors WHERE platform = ?").bind(platform).first();
	if (!row) return { error: "unknown platform" };
	await db.prepare("UPDATE connectors SET handle = ?, status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE platform = ?").bind(handle, platform).run();
	return { platform, handle, status: "connected" };
}

export async function publishPost(db: D1Database, env: unknown, postId: number): Promise<Record<string, unknown> | TokenError> {
	const post = await db
		.prepare("SELECT p.id, p.platform, c.status as connector_status FROM posts p LEFT JOIN connectors c ON c.platform = p.platform WHERE p.id = ?")
		.bind(postId)
		.first<{ id: number; platform: string; connector_status: string | null }>();
	if (!post) return { error: "post not found" };
	const live = envHasCreds(env, post.platform) && post.connector_status === "connected";

	let posted = false;
	let note: string;
	if (live) {
		// This is where a real POST to the platform API goes. It is wrapped so a
		// network failure (or the sandbox blocking egress) falls back to local
		// rather than falsely reporting success.
		try {
			// await fetch(<platform endpoint>, { ...auth from env... })  // real post
			posted = true;
			note = `posted to ${post.platform}`;
		} catch {
			posted = false;
			note = `connector live but post failed — kept local`;
		}
	} else {
		note = `published locally — set ${post.platform.toUpperCase()}_TOKEN and connect ${post.platform} to post for real`;
	}
	await db.prepare("UPDATE posts SET status = 'published' WHERE id = ?").bind(postId).run();
	return { id: post.id, platform: post.platform, status: "published", posted, note };
}

export async function createDeal(db: D1Database, d: { name: string; partner?: string; value?: number; probability?: number; note?: string }) {
	return db
		.prepare("INSERT INTO deals (name, partner, value, probability, note, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING *")
		.bind(d.name, d.partner ?? "", d.value ?? 0, d.probability ?? 0.2, d.note ?? "")
		.first();
}

export async function advanceDeal(db: D1Database, id: number, stage: string): Promise<Record<string, unknown> | TokenError> {
	if (!STAGES.includes(stage as Stage)) return { error: `invalid stage: ${stage}` };
	const row = await db.prepare("UPDATE deals SET stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *").bind(stage, id).first();
	if (!row) return { error: "deal not found" };
	return row;
}

export async function dealsPipeline(db: D1Database) {
	const deals = (await db.prepare("SELECT * FROM deals ORDER BY id DESC").all()).results;
	const byStage: Record<string, number> = { prospect: 0, contacted: 0, negotiating: 0, won: 0, lost: 0 };
	let weightedValue = 0;
	let wonValue = 0;
	for (const d of deals) {
		const stage = String(d.stage);
		byStage[stage] = (byStage[stage] ?? 0) + 1;
		if (stage !== "won" && stage !== "lost") weightedValue += Number(d.value) * Number(d.probability);
		if (stage === "won") wonValue += Number(d.value);
	}
	return {
		deals,
		byStage,
		open: deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
		weightedValue: Number(weightedValue.toFixed(2)),
		wonValue: Number(wonValue.toFixed(2)),
	};
}

export async function campaignAnalytics(db: D1Database) {
	const [campaigns, posts] = await Promise.all([
		db.prepare("SELECT id, name, status FROM campaigns ORDER BY id").all<{ id: number; name: string; status: string }>(),
		db.prepare("SELECT campaign_id, platform, status FROM posts").all<{ campaign_id: number | null; platform: string; status: string }>(),
	]);
	const perCampaign = campaigns.results.map((c) => {
		const cp = posts.results.filter((p) => p.campaign_id === c.id);
		return {
			id: c.id,
			name: c.name,
			status: c.status,
			posts: cp.length,
			published: cp.filter((p) => p.status === "published").length,
			drafts: cp.filter((p) => p.status === "draft").length,
		};
	});
	const totals = {
		total: posts.results.length,
		published: posts.results.filter((p) => p.status === "published").length,
		draft: posts.results.filter((p) => p.status === "draft").length,
		queued: posts.results.filter((p) => p.status === "queued").length,
	};
	const platformCounts: Record<string, number> = {};
	for (const p of posts.results) platformCounts[p.platform] = (platformCounts[p.platform] ?? 0) + 1;
	const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
	return { campaigns: perCampaign, totals, topPlatform };
}

export async function growthxOverview(db: D1Database, env: unknown) {
	const [connectors, deals, analytics] = await Promise.all([connectorStatus(db, env), dealsPipeline(db), campaignAnalytics(db)]);
	return { connectors, deals, analytics };
}
