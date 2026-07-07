// The Growth realm: PR, content, and lead-gen. Lumi drafts high-production
// marketing copy for the creator to review, groups it into campaigns, and hunts
// opportunities.
//
// HONESTY BOUNDARY — read this before trusting a status:
//   * Posts are DRAFTS. The creator reviews everything. "Publishing" here just
//     flips a LOCAL status flag to 'published'; no social account (X, LinkedIn,
//     Instagram, a blog) is connected, so NOTHING is actually posted to a real
//     network. Wiring real publishing needs connected accounts + OAuth, which
//     this system does not have.
//   * scoutOpportunities() is curated and offline-safe: it seeds realistic,
//     hand-written leads. It does NOT search the web, scrape, or contact anyone,
//     and it never spends ad money.
//
// Brand voice: confident, plainspoken, evidence-first. Product is "Lumi", a
// living AI that runs a creator's world; the token is "AETHER" on Sui.

export const PLATFORMS = ["x", "linkedin", "instagram", "blog"] as const;
export type Platform = (typeof PLATFORMS)[number];

const DEFAULT_TOPIC = "Lumi + AETHER launch";

export interface PostRow {
	id: number;
	campaign_id: number | null;
	platform: string;
	kind: string;
	title: string;
	body: string;
	media_prompt: string;
	status: string;
	created_at: string;
}

export interface CampaignRow {
	id: number;
	name: string;
	goal: string;
	status: string;
	created_at: string;
}

export interface LeadRow {
	id: number;
	name: string;
	kind: string;
	source: string;
	status: string;
	value: number;
	note: string;
	created_at: string;
}

export type PostStatus = "draft" | "queued" | "published";
export type LeadKind = "partner" | "broker" | "placement" | "investor" | "user" | "press";

interface Draft {
	title: string;
	body: string;
	media_prompt: string;
}

// Built-in, platform-tuned copy templates. Each weaves in `topic` and always
// returns a media_prompt (a one-line brief for the image/video to create).
const TEMPLATES: Record<Platform, (topic: string) => Draft> = {
	x: (topic) => ({
		title: `Meet Lumi — a living AI that runs ${topic}`,
		body:
			`Your world shouldn't need a dashboard to run itself.\n` +
			`Lumi trades, audits, and ships while you sleep — every move on the record.\n` +
			`AETHER on Sui is the credit that powers it. No hype, just receipts.\n` +
			`See it work → #Lumi #AETHER #Sui`,
		media_prompt: `A dark, cinematic product shot of a glowing neural orb labeled "Lumi" orchestrating trading, content, and audit panels around it — deep indigo and electric-teal palette, 16:9.`,
	}),
	linkedin: (topic) => ({
		title: `Why we built Lumi: ${topic}`,
		body:
			`Most "AI assistants" wait to be asked. Lumi doesn't. ` +
			`It runs a creator's world end to end — paper trading, audits, content drafts, and growth — and records every decision so nothing is taken on faith. ` +
			`The AETHER token on Sui meters that work as verifiable, on-ledger credit. ` +
			`The takeaway: autonomy is only trustworthy when it's auditable — so we made the audit trail the product, not an afterthought.`,
		media_prompt: `A clean, professional graphic: a calm operator watching an autonomous system self-manage, with a subtle audit-log motif; muted navy and teal, generous whitespace, 1.91:1.`,
	}),
	instagram: (topic) => ({
		title: `Lumi is awake ✨ ${topic}`,
		body:
			`This is what a living AI looks like when it actually runs your world.\n` +
			`Lumi never sleeps, never guesses, and leaves a trail for everything it touches. ` +
			`AETHER on Sui is the pulse underneath.\n` +
			`Tap in — the future runs itself.\n` +
			`#Lumi #AETHER #Sui #AIagents #CreatorEconomy #BuildInPublic`,
		media_prompt: `A vivid vertical 4:5 hero: a bioluminescent orb pulsing over a creator's desk at night, threads of teal light connecting to floating cards (trades, posts, audits); dreamy, high-contrast, cinematic depth of field.`,
	}),
	blog: (topic) => ({
		title: `${topic}: a living AI that earns your trust by showing its work`,
		body:
			`We didn't set out to build another chatbot. We set out to build something that runs — a system that trades, audits, drafts, and grows a creator's world without waiting to be told, and proves what it did.\n\n` +
			`Lumi is that system. Underneath it, the AETHER token on Sui turns every unit of work into verifiable, on-ledger credit, so autonomy never means opacity. Each action leaves a record you can check.\n\n` +
			`This post is a teaser. Over the next few weeks we'll open up the ledger, the audit sweeps, and the growth engine — and show, receipt by receipt, exactly how ${topic} holds up under scrutiny.`,
		media_prompt: `A wide editorial banner: an elegant schematic of Lumi's systems — trading, audit, content, growth — linked by a single luminous ledger line; refined, minimal, teal-on-charcoal, 2:1.`,
	}),
}

// Draft a marketing post for one platform, insert it, and file a content report.
// The post is a DRAFT — the creator reviews before anything ships.
export async function draftPost(
	db: D1Database,
	opts: { platform: Platform; topic?: string; campaignId?: number },
): Promise<PostRow> {
	const topic = (opts.topic ?? DEFAULT_TOPIC).trim() || DEFAULT_TOPIC;
	const draft = TEMPLATES[opts.platform](topic);
	const campaignId = opts.campaignId ?? null;

	const post = await db
		.prepare(
			`INSERT INTO posts (campaign_id, platform, kind, title, body, media_prompt, status)
			 VALUES (?, ?, 'post', ?, ?, ?, 'draft') RETURNING *`,
		)
		.bind(campaignId, opts.platform, draft.title, draft.body, draft.media_prompt)
		.first<PostRow>();

	// File a content report so the draft shows up in the feed. The title is the
	// post's title/hook.
	await db
		.prepare(
			`INSERT INTO reports (author, kind, title, body, data, realm)
			 VALUES ('lumi', 'content', ?, ?, ?, 'growth')`,
		)
		.bind(
			draft.title,
			`Drafted a ${opts.platform} post about "${topic}" for review. Not published — connect an account to post for real.`,
			JSON.stringify({ platform: opts.platform, topic, postId: post!.id }),
		)
		.run();

	return post!;
}

// Flip a post's local status. 'published' does NOT post to any real network —
// it only marks the draft as ready locally; the returned object says so.
export async function setPostStatus(
	db: D1Database,
	id: number,
	status: PostStatus,
): Promise<(PostRow & { note?: string }) | null> {
	const post = await db
		.prepare("UPDATE posts SET status = ? WHERE id = ? RETURNING *")
		.bind(status, id)
		.first<PostRow>();
	if (!post) return null;
	if (status === "published") {
		return { ...post, note: "published locally — connect an account to post for real" };
	}
	return post;
}

export async function createCampaign(
	db: D1Database,
	opts: { name: string; goal?: string },
): Promise<CampaignRow> {
	const row = await db
		.prepare("INSERT INTO campaigns (name, goal) VALUES (?, ?) RETURNING *")
		.bind(opts.name, opts.goal ?? "")
		.first<CampaignRow>();
	return row!;
}

export async function addLead(
	db: D1Database,
	opts: { name: string; kind: LeadKind; source?: string; value?: number; note?: string },
): Promise<LeadRow> {
	const row = await db
		.prepare(
			"INSERT INTO leads (name, kind, source, value, note) VALUES (?, ?, ?, ?, ?) RETURNING *",
		)
		.bind(opts.name, opts.kind, opts.source ?? "", opts.value ?? 0, opts.note ?? "")
		.first<LeadRow>();
	return row!;
}

// Curated, offline-safe opportunity bank. These are realistic, hand-written
// leads — NOT the result of any live search, scrape, or outreach. Re-running
// dedups by name, so the pipeline never fills with duplicates.
const OPPORTUNITY_BANK: { name: string; kind: LeadKind; source: string; value: number; note: string }[] = [
	{ name: "Sui Ecosystem Fund", kind: "partner", source: "directory", value: 25000, note: "Grants for AETHER-native tooling on Sui." },
	{ name: "CreatorStack Newsletter", kind: "placement", source: "inbound", value: 4000, note: "Feature slot on autonomous creator tools." },
	{ name: "Node Ventures", kind: "broker", source: "conference", value: 15000, note: "Intro broker for web3 infra rounds." },
	{ name: "The Autonomy Report", kind: "press", source: "inbound", value: 0, note: "Wants a briefing on evidence-first AI agents." },
	{ name: "IndieHackers AI Track", kind: "placement", source: "directory", value: 2500, note: "Launch placement for build-in-public products." },
	{ name: "Meridian Growth Partners", kind: "broker", source: "conference", value: 12000, note: "Connects seed-stage AI startups to distribution." },
];

export async function scoutOpportunities(db: D1Database): Promise<{ found: number; stored: number }> {
	// Deterministic curated slice (3-5 leads). Offline-safe — no network calls.
	const batch = OPPORTUNITY_BANK.slice(0, 5);

	const existing = (
		await db.prepare("SELECT name FROM leads").all<{ name: string }>()
	).results.map((r) => r.name);
	const existingSet = new Set(existing);

	let stored = 0;
	for (const lead of batch) {
		if (existingSet.has(lead.name)) continue;
		await db
			.prepare("INSERT INTO leads (name, kind, source, value, note) VALUES (?, ?, ?, ?, ?)")
			.bind(lead.name, lead.kind, lead.source, lead.value, lead.note)
			.run();
		existingSet.add(lead.name);
		stored++;
	}

	await db
		.prepare(
			`INSERT INTO reports (author, kind, title, body, data, realm)
			 VALUES ('lumi', 'scout', 'Opportunity scout', ?, ?, 'growth')`,
		)
		.bind(
			`Curated ${batch.length} opportunities, added ${stored} new to the pipeline. Offline & curated — no live search or outreach.`,
			JSON.stringify({ found: batch.length, stored }),
		)
		.run();

	return { found: batch.length, stored };
}

export async function growthOverview(db: D1Database) {
	const [campaigns, posts, leads] = await Promise.all([
		db.prepare("SELECT * FROM campaigns ORDER BY id DESC").all<CampaignRow>(),
		db.prepare("SELECT * FROM posts ORDER BY id DESC").all<PostRow>(),
		db.prepare("SELECT * FROM leads ORDER BY id DESC").all<LeadRow>(),
	]);

	const postRows = posts.results;
	const byStatus = { draft: 0, queued: 0, published: 0 } as Record<string, number>;
	for (const p of postRows) {
		if (p.status in byStatus) byStatus[p.status]++;
	}

	const leadRows = leads.results;
	const leadByStatus = { new: 0, contacted: 0, won: 0, lost: 0 } as Record<string, number>;
	const byKind: Record<string, number> = {};
	let pipelineValue = 0;
	for (const l of leadRows) {
		if (l.status in leadByStatus) leadByStatus[l.status]++;
		byKind[l.kind] = (byKind[l.kind] ?? 0) + 1;
		if (l.status !== "lost") pipelineValue += l.value;
	}

	return {
		campaigns: campaigns.results,
		posts: {
			total: postRows.length,
			byStatus: {
				draft: byStatus.draft,
				queued: byStatus.queued,
				published: byStatus.published,
			},
			recent: postRows.slice(0, 8),
		},
		leads: {
			total: leadRows.length,
			byStatus: leadByStatus,
			byKind,
			pipelineValue,
			recent: leadRows.slice(0, 8),
		},
		funnel: {
			leads: leadRows.length,
			contacted: leadByStatus.contacted + leadByStatus.won,
			won: leadByStatus.won,
		},
	};
}
