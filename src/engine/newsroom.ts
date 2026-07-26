// THE NEWSROOM — hourly posts drafted from what actually happened.
//
// The old drafting had four fixed templates with a topic word swapped in. Run
// that on an hourly schedule and it produces the same four posts forever:
// fluent, confident, and carrying no information. A feed like that is worse
// than silence, because it trains people to skip you.
//
// This system already generates real material every hour. It closes trades,
// breeds a new strategy generation, retires a strategy for losing money, scores
// its own security posture, catches its own structural drift, completes quests,
// pays citizens in a Roblox city. That is a build-in-public feed sitting unread
// in the Databank.
//
// So: read the state, find what is genuinely newsworthy since the last time,
// and write copy that cites the actual numbers. Three rules that matter more
// than the copy itself:
//
//   1. NOTHING TO SAY MEANS NOTHING POSTED. A quiet hour drafts zero posts.
//      An hourly feed that must fill every slot is how you end up inventing.
//   2. NEVER TWICE. Every event carries a key derived from the event itself,
//      so a fact cannot be drafted again however many pulses run.
//   3. ONLY WHAT IS TRUE. Every number in every draft comes from a row. The
//      copy is opinionated about framing and never about facts — and posts stay
//      DRAFTS until the creator has a connector configured, so nothing reaches
//      an audience without them.

import { writeWithClaude } from "./copywriter";

export type Platform = "x" | "linkedin" | "instagram" | "blog";

export interface NewsEvent {
	key: string; // stable identity — the dedupe contract
	kind: string;
	weight: number; // how newsworthy, 0..1 — the best story goes out first
	headline: string;
	facts: string; // the specifics, already formatted
	angle: string; // why a reader should care
}

// Rounded thresholds worth remarking on. Crossing one is a story; sitting near
// one is not.
function crossedMilestone(pct: number): number | null {
	for (const m of [100, 50, 25, 10, 5]) if (pct >= m) return m;
	return null;
}

export async function gatherNews(db: D1Database, env: unknown): Promise<NewsEvent[]> {
	const events: NewsEvent[] = [];

	const [colony, newest, retired, posture, integrity, quests, citizens, pulses, supply] = await Promise.all([
		db
			.prepare(
				`SELECT COALESCE(SUM(balance),0) AS equity, COALESCE(SUM(starting_balance),0) AS start,
				        (SELECT COUNT(*) FROM trades WHERE outcome != 'open') AS closed,
				        (SELECT COUNT(*) FROM trades WHERE outcome = 'win') AS wins
				 FROM bots`,
			)
			.first<{ equity: number; start: number; closed: number; wins: number }>(),
		db.prepare("SELECT name, generation FROM strategies WHERE status = 'active' ORDER BY generation DESC, id DESC LIMIT 1").first<{ name: string; generation: number }>(),
		db
			.prepare(
				`SELECT s.name, COUNT(t.id) AS closed, COALESCE(AVG(t.pnl),0) AS expectancy,
				        SUM(CASE WHEN t.outcome='win' THEN 1 ELSE 0 END)*1.0/COUNT(t.id) AS wr
				 FROM strategies s JOIN trades t ON t.strategy_id = s.id AND t.outcome != 'open'
				 WHERE s.status = 'retired' GROUP BY s.id ORDER BY s.id DESC LIMIT 1`,
			)
			.first<{ name: string; closed: number; expectancy: number; wr: number }>(),
		// The last RECORDED posture score. Calling assessPosture here would
		// re-run the guard probe on every drafting pass — far too heavy for
		// something that only wants to know the most recent number.
		db.prepare("SELECT value, meta FROM metrics WHERE kind = 'shield_score' ORDER BY id DESC LIMIT 1").first<{ value: number; meta: string }>(),
		db.prepare("SELECT status, detail FROM checks WHERE name = 'app-integrity' ORDER BY id DESC LIMIT 1").first<{ status: string; detail: string }>(),
		db.prepare("SELECT title, xp_reward, skill FROM quests WHERE status = 'done' ORDER BY id DESC LIMIT 1").first<{ title: string; xp_reward: number; skill: string }>(),
		db.prepare("SELECT COUNT(*) AS n FROM aether_accounts WHERE kind = 'rp'").first<{ n: number }>(),
		db.prepare("SELECT pulses FROM lumi_state WHERE id = 1").first<{ pulses: number }>(),
		db.prepare("SELECT COALESCE(SUM(balance),0) AS total FROM aether_accounts").first<{ total: number }>(),
	]);

	// --- A return milestone crossed. Real number, stated as paper trading.
	if (colony && colony.start > 0 && colony.closed > 20) {
		const pct = ((colony.equity - colony.start) / colony.start) * 100;
		const m = crossedMilestone(pct);
		if (m !== null) {
			events.push({
				key: `milestone:${m}`,
				kind: "milestone",
				weight: 0.7,
				headline: `Paper capital up ${pct.toFixed(1)}%`,
				facts: `${colony.closed} closed trades, ${((colony.wins / Math.max(1, colony.closed)) * 100).toFixed(1)}% win rate, ${colony.equity.toFixed(0)} from ${colony.start.toFixed(0)} starting.`,
				angle: "Paper trading, on a simulated tape — no broker, no real money. The interesting part is not the number, it is that every trade behind it is on the record and re-checkable.",
			});
		}
	}

	// --- A strategy retired for losing money. The best story the system has,
	// because it is the one nobody volunteers about their own product.
	if (retired && retired.expectancy < 0 && retired.closed >= 8) {
		events.push({
			key: `retired:${retired.name}`,
			kind: "retirement",
			weight: 1,
			headline: `We killed a strategy that was right ${(retired.wr * 100).toFixed(0)}% of the time`,
			facts: `"${retired.name}" won ${(retired.wr * 100).toFixed(0)}% of ${retired.closed} trades and still lost ${Math.abs(retired.expectancy).toFixed(3)} per trade on average. Retired.`,
			angle: "A high hit rate that loses money is the most flattering way to fail. Win rate is the number that makes a system look good; expectancy is the one that says whether it works.",
		});
	}

	// --- A new generation. Evolution is the product's actual claim.
	if (newest && newest.generation > 1) {
		events.push({
			key: `evolution:g${newest.generation}`,
			kind: "evolution",
			weight: 0.6,
			headline: `Generation ${newest.generation} is live`,
			facts: `"${newest.name}" was bred from the best-scoring strategy in the colony and funded at a quarter of a founder's stake until it proves itself.`,
			angle: "A new idea is a hypothesis, so it gets hypothesis money. Capital follows evidence, not enthusiasm.",
		});
	}

	// --- Security posture, only when it is actually good enough to mention.
	const postureScore = posture?.value ?? 0;
	const postureGrade = (() => {
		try {
			return String(JSON.parse(posture?.meta ?? "{}").grade ?? "");
		} catch {
			return "";
		}
	})();
	if (posture && postureScore >= 70) {
		events.push({
			key: `posture:${postureGrade}${Math.round(postureScore / 5) * 5}`,
			kind: "security",
			weight: 0.5,
			headline: `Security posture ${postureScore}/100 (${postureGrade})`,
			facts: `Scored from live state across six dimensions — contract, custody, privacy, decentralization, red-team, and authority — not from a checklist.`,
			angle: "The score drops the moment we grant ourselves more power, because power is a cost and it should show up as one.",
		});
	}

	// --- Structural integrity. A green self-check is worth saying once.
	if (integrity?.status === "pass") {
		events.push({
			key: `integrity:${integrity.detail.split(" ")[0]}`,
			kind: "integrity",
			weight: 0.4,
			headline: `The app checks whether its own code still matches its database`,
			facts: integrity.detail,
			angle: "Most rot is silent: a command that no longer routes, a permission that can never be granted, a report filed under a name nothing renders. All of it ships green. So we test for it.",
		});
	}

	// --- A completed quest — real progress, earned from recorded work.
	if (quests) {
		events.push({
			key: `quest:${quests.title}`,
			kind: "quest",
			weight: 0.35,
			headline: `Quest complete: ${quests.title}`,
			facts: `+${quests.xp_reward} ${quests.skill}. Quests only advance from work actually recorded in the database.`,
			angle: "XP you cannot earn by asking for it is the only kind worth tracking.",
		});
	}

	// --- Citizens in the Roblox city, on the same conserved ledger.
	if ((citizens?.n ?? 0) > 0) {
		const n = citizens!.n;
		events.push({
			key: `citizens:${Math.floor(n / 5) * 5}`,
			kind: "gaming",
			weight: 0.45,
			headline: `${n} citizen${n === 1 ? "" : "s"} earning in the city`,
			facts: `InMotion RP players hold AETHER on the same fixed-supply ledger as everything else — total supply ${(supply?.total ?? 0).toFixed(0)}, conserved on every move.`,
			angle: "A game economy that can mint is not an economy. The city asks the treasury and the treasury can run dry.",
		});
	}

	// --- Unattended streak. Only once it is genuinely a streak.
	const pulseCount = pulses?.pulses ?? 0;
	if (pulseCount >= 24) {
		const p = pulseCount;
		events.push({
			key: `pulses:${Math.floor(p / 24) * 24}`,
			kind: "autonomy",
			weight: 0.3,
			headline: `${p} unattended cycles`,
			facts: `Every hour: trade, learn, audit, sweep, scout for real prices, self-check. Each run is recorded, so a schedule that stops becomes a visible gap instead of numbers going quietly stale.`,
			angle: "Automation you cannot verify is automation you cannot trust, and trusting it is the entire point.",
		});
	}

	return events.sort((a, b) => b.weight - a.weight);
}

// Turn one real event into platform-shaped copy. The framing differs per
// platform; the facts never do.
export function writePost(e: NewsEvent, platform: Platform): { title: string; body: string; media_prompt: string } {
	const tags = "#BuildInPublic #AIagents #AETHER";
	switch (platform) {
		case "x":
			return {
				title: e.headline,
				body: `${e.headline}.\n\n${e.facts}\n\n${e.angle}\n\n${tags}`,
				media_prompt: `A dark cinematic 16:9 card showing "${e.headline}" as the only text, over a faint schematic of an autonomous system; deep indigo and electric teal.`,
			};
		case "linkedin":
			return {
				title: e.headline,
				body:
					`${e.headline}.\n\n${e.facts}\n\n${e.angle}\n\n` +
					`Built on Cloudflare Workers + D1. Everything above is read from recorded rows, not written by hand — and the drafts stay drafts until a human ships them.`,
				media_prompt: `A clean professional 1.91:1 graphic: one large statistic — "${e.headline}" — with a subtle audit-log motif beneath; muted navy and teal, generous whitespace.`,
			};
		case "instagram":
			return {
				title: e.headline,
				body: `${e.headline} ✨\n\n${e.facts}\n\n${e.angle}\n\n${tags} #CreatorEconomy`,
				media_prompt: `A vivid vertical 4:5 hero: a bioluminescent orb over a night desk, one floating card reading "${e.headline}"; high contrast, cinematic depth of field.`,
			};
		case "blog":
			return {
				title: e.headline,
				body:
					`## ${e.headline}\n\n${e.facts}\n\n${e.angle}\n\n` +
					`### Why this is written down\n\n` +
					`This post was drafted by the system it describes, from rows in its own database, on an hourly schedule. It only writes when something actually happened — a quiet hour produces nothing, because a feed obliged to fill every slot is a feed that starts inventing.\n`,
				media_prompt: `A wide 2:1 editorial banner: an elegant schematic linking trading, audit, content and growth by one luminous ledger line; teal on charcoal, minimal.`,
			};
	}
}

const ROTATION: Platform[] = ["x", "linkedin", "instagram", "blog"];

export interface NewsroomRun {
	drafted: number;
	skipped: number;
	posts: { platform: Platform; title: string; key: string; writer: string; note: string }[];
	note: string;
}

// Draft up to `max` posts from the freshest real news, skipping anything
// already covered. Returns what it wrote AND what it deliberately did not.
export async function runNewsroom(db: D1Database, env: unknown, max = 3): Promise<NewsroomRun> {
	const events = await gatherNews(db, env);
	const posts: NewsroomRun["posts"] = [];
	let skipped = 0;
	// Rotate platforms across the whole feed's history, not per event. Hashing
	// the key alone clustered drafts onto one platform — two posts in a row on
	// the same channel is the single-voice problem the templates already had.
	const already = await db.prepare("SELECT COUNT(*) AS n FROM posts WHERE event_key != ''").first<{ n: number }>();
	let slot = already?.n ?? 0;

	for (const e of events) {
		if (posts.length >= max) break;
		const seen = await db.prepare("SELECT 1 AS one FROM posts WHERE event_key = ? LIMIT 1").bind(e.key).first<{ one: number }>();
		if (seen) {
			skipped++;
			continue;
		}
		const platform = ROTATION[slot % ROTATION.length];
		slot++;
		const base = writePost(e, platform);
		// Claude gets to choose every word and not a single fact — its draft is
		// rejected outright if it contains a figure the facts do not.
		const written = await writeWithClaude(e, platform, env, { title: base.title, body: base.body });
		await db
			.prepare(
				`INSERT INTO posts (platform, kind, title, body, media_prompt, status, event_key, writer, writer_note)
				 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
			)
			.bind(platform, e.kind, written.title, written.body, base.media_prompt, e.key, written.writer, written.note)
			.run();
		posts.push({ platform, title: written.title, key: e.key, writer: written.writer, note: written.note });
	}

	if (posts.length > 0) {
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('growth', 'content', ?, ?, ?, 'growth')")
			.bind(
				`Newsroom drafted ${posts.length} post${posts.length === 1 ? "" : "s"}`,
				posts.map((p) => `${p.platform}: ${p.title}`).join("\n"),
				JSON.stringify({ posts, skipped }),
			)
			.run();
	}

	return {
		drafted: posts.length,
		skipped,
		posts,
		note:
			posts.length > 0
				? `Drafted from real recorded events. ${skipped} already covered. Every draft stays a draft until a connector is configured and a human ships it.`
				: `Nothing new to say this hour — ${skipped} event(s) already covered, so nothing was drafted. A feed that must fill every slot is a feed that starts inventing.`,
	};
}
