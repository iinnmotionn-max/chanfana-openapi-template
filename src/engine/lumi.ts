// Lumi's living brain: skill progression, quests, and the autonomous pulse.
// Her state lives in the Databank; her skill levels feed back into the engine
// (Insight drives learning depth, Engineering drives trading throughput), so
// as she levels up, the system she runs genuinely evolves with her.

import { runCycle } from "./trader";
import { runLearning } from "./learning";
import { auditInvest, recordAudit } from "./integrity";
import { runSweep } from "./guardian";
import { research, scoutMarket } from "./knowledge";
import { runNewsroom } from "./newsroom";
import { runStudy } from "./training";
import { reward } from "./token";
import { ensureAetherWallet } from "./wallet";
import { actOnInitiative } from "./autonomy";

export type SkillName = "insight" | "vigilance" | "engineering" | "empathy";

export interface LumiProfile {
	skills: Record<SkillName, { xp: number; level: number }>;
	totalXp: number;
	level: number;
	prevLevelXp: number;
	nextLevelXp: number;
	pulses: number;
}

// Levels follow a square curve: skill level n+1 costs 100*n^2 XP, Lumi's
// overall level n+1 costs 150*n^2 total XP.
export const skillLevel = (xp: number) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100));
const overallLevel = (xp: number) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 150));

export async function getLumi(db: D1Database): Promise<LumiProfile> {
	const row = await db.prepare("SELECT skills, pulses FROM lumi_state WHERE id = 1").first<{ skills: string; pulses: number }>();
	const raw = safeJson(row?.skills ?? "{}");
	const skills = Object.fromEntries(
		(["insight", "vigilance", "engineering", "empathy"] as SkillName[]).map((name) => {
			const xp = Number(raw[name] ?? 0);
			return [name, { xp, level: skillLevel(xp) }];
		}),
	) as LumiProfile["skills"];
	const totalXp = Object.values(skills).reduce((n, s) => n + s.xp, 0);
	const level = overallLevel(totalXp);
	return {
		skills,
		totalXp,
		level,
		prevLevelXp: 150 * (level - 1) ** 2,
		nextLevelXp: 150 * level ** 2,
		pulses: row?.pulses ?? 0,
	};
}

// Award XP to a skill; a level-up files a report so the feed celebrates it.
export async function awardXp(db: D1Database, skill: SkillName, amount: number, reason: string): Promise<void> {
	if (amount <= 0) return;
	const before = await getLumi(db);
	const raw = Object.fromEntries(Object.entries(before.skills).map(([k, v]) => [k, v.xp]));
	raw[skill] = (raw[skill] ?? 0) + Math.round(amount);
	await db
		.prepare("UPDATE lumi_state SET skills = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1")
		.bind(JSON.stringify(raw))
		.run();
	const newLevel = skillLevel(raw[skill]);
	if (newLevel > before.skills[skill].level) {
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'levelup', ?, ?, ?, 'tech')")
			.bind(
				`Lumi's ${skill} reached level ${newLevel}`,
				`${reason} pushed ${skill} to level ${newLevel} (${raw[skill]} XP). Her ${skill === "insight" ? "learning runs deeper" : skill === "engineering" ? "engine runs harder" : skill === "vigilance" ? "watch grows sharper" : "bond grows stronger"} now.`,
				JSON.stringify({ skill, level: newLevel, xp: raw[skill] }),
			)
			.run();
	}
}

export async function recordMetric(db: D1Database, kind: string, value: number, meta: unknown = {}): Promise<void> {
	await db.prepare("INSERT INTO metrics (kind, value, meta) VALUES (?, ?, ?)").bind(kind, value, JSON.stringify(meta)).run();
}

export interface PerfStat {
	kind: string;
	count: number;
	avg: number;
	last: number;
}

export async function perfSummary(db: D1Database): Promise<PerfStat[]> {
	const rows = (
		await db
			.prepare(
				`SELECT m.kind, s.count, s.avg, m.value as last
				 FROM metrics m
				 JOIN (SELECT kind, MAX(id) as mid, COUNT(*) as count, AVG(value) as avg FROM metrics GROUP BY kind) s
				   ON s.mid = m.id`,
			)
			.all<{ kind: string; count: number; avg: number; last: number }>()
	).results;
	return rows.map((r) => ({ kind: r.kind, count: r.count, avg: Number(r.avg.toFixed(1)), last: Number(r.last.toFixed(1)) }));
}

// Evaluate every open quest against the real Databank state; completed quests
// pay out XP and file a report. Returns quests that completed this pass.
export async function checkQuests(db: D1Database): Promise<{ title: string; skill: SkillName; xp: number }[]> {
	const [bots, closed, retired, maxGen, equity, cleanAudits, cleanSweeps, checkins, tick, knowledge, snapshots, auras, lessons] = await Promise.all([
		db.prepare("SELECT COUNT(*) as v FROM bots").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM trades WHERE outcome != 'open'").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM strategies WHERE status = 'retired'").first<{ v: number }>(),
		db.prepare("SELECT COALESCE(MAX(generation), 0) as v FROM strategies").first<{ v: number }>(),
		db
			.prepare("SELECT COALESCE(SUM(balance), 0) as b, COALESCE(SUM(starting_balance), 0) as s FROM bots")
			.first<{ b: number; s: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM reports WHERE kind = 'audit' AND body LIKE '%0 fail.%' AND body LIKE '%0 warn%'").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM reports WHERE kind = 'sweep' AND body LIKE '%0 warn, 0 fail.%'").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM wellness_checkins").first<{ v: number }>(),
		db.prepare("SELECT COALESCE(MAX(tick), 0) as v FROM market_state").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM knowledge").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM knowledge WHERE kind = 'market-snapshot'").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM auras").first<{ v: number }>(),
		db.prepare("SELECT COUNT(*) as v FROM knowledge WHERE kind = 'lesson'").first<{ v: number }>(),
	]);
	const state: Record<string, number> = {
		bots: bots?.v ?? 0,
		closed_trades: closed?.v ?? 0,
		retired_strategies: retired?.v ?? 0,
		max_generation: maxGen?.v ?? 0,
		equity_ratio: (equity?.s ?? 0) > 0 ? equity!.b / equity!.s : 0,
		clean_audits: cleanAudits?.v ?? 0,
		clean_sweeps: cleanSweeps?.v ?? 0,
		checkins: checkins?.v ?? 0,
		market_tick: tick?.v ?? 0,
		knowledge_items: knowledge?.v ?? 0,
		market_snapshots: snapshots?.v ?? 0,
		auras: auras?.v ?? 0,
		lessons: lessons?.v ?? 0,
	};

	const open = (
		await db.prepare("SELECT * FROM quests WHERE status = 'open'").all<{
			id: number;
			title: string;
			skill: SkillName;
			xp_reward: number;
			metric: string;
			target: number;
		}>()
	).results;

	const completed: { title: string; skill: SkillName; xp: number }[] = [];
	for (const quest of open) {
		const current = state[quest.metric] ?? 0;
		const progress = Math.min(1, current / quest.target);
		if (progress >= 1) {
			await db
				.prepare("UPDATE quests SET status = 'done', progress = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
				.bind(quest.id)
				.run();
			await awardXp(db, quest.skill, quest.xp_reward, `Quest "${quest.title}"`);
			// Completed work also earns Aether credits from the treasury.
			await reward(db, "lumi", quest.xp_reward, `Quest "${quest.title}"`);
			await db
				.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'quest', ?, ?, ?, 'tech')")
				.bind(
					`Quest complete: ${quest.title}`,
					`Lumi earned ${quest.xp_reward} ${quest.skill} XP and ${quest.xp_reward} AETHER.`,
					JSON.stringify({ questId: quest.id, skill: quest.skill, xp: quest.xp_reward }),
				)
				.run();
			completed.push({ title: quest.title, skill: quest.skill, xp: quest.xp_reward });
		} else {
			await db.prepare("UPDATE quests SET progress = ? WHERE id = ?").bind(progress, quest.id).run();
		}
	}
	return completed;
}

// ---- Situational & positional awareness ----
// Lumi knows where she is in her own development, what stage she's at, what
// her current initiative is, and what's blocking her — assessed from the
// Databank, never assumed.

export interface Awareness {
	stage: string;
	focus: string;
	statement: string;
	initiative: { quest: string; metric: string; progress: number; action: string } | null;
	blockers: string[];
	position: { winRate: number; closedTrades: number; knowledge: number; questsDone: number; questsTotal: number };
}

const STAGES = [
	{ min: 12, name: "Sage", focus: "mastery across all realms" },
	{ min: 8, name: "Strategist", focus: "compounding wins and expanding the colony" },
	{ min: 5, name: "Operator", focus: "automation, knowledge, and consistency" },
	{ min: 3, name: "Apprentice", focus: "building evidence and raising the win rate" },
	{ min: 1, name: "Hatchling", focus: "proving the loop end to end" },
];

const ACTION_FOR_METRIC: Record<string, string> = {
	bots: "seed the colony",
	closed_trades: "trade more ticks",
	market_tick: "trade more ticks",
	retired_strategies: "keep the learning passes coming",
	max_generation: "evolve the champion line",
	equity_ratio: "compound through more cycles",
	clean_audits: "run the ledger audit",
	clean_sweeps: "run protection sweeps",
	checkins: "wait for the creator to check in",
	knowledge_items: "research the outside world",
	market_snapshots: "scout live market prices",
	auras: "wait for the creator to profile a client or investor",
	lessons: "study the trading curriculum with Aether",
};

export async function selfAssess(db: D1Database): Promise<{ lumi: LumiProfile; awareness: Awareness }> {
	const lumi = await getLumi(db);
	const stage = STAGES.find((s) => lumi.level >= s.min) ?? STAGES[STAGES.length - 1];

	const [quests, closed, wins, knowledge, alerts] = await Promise.all([
		db.prepare("SELECT title, metric, progress, status FROM quests ORDER BY id").all<{
			title: string;
			metric: string;
			progress: number;
			status: string;
		}>(),
		db.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome != 'open'").first<{ n: number }>(),
		db.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome = 'win'").first<{ n: number }>(),
		db.prepare("SELECT COUNT(*) as n FROM knowledge").first<{ n: number }>(),
		db.prepare("SELECT key FROM realms WHERE status = 'alert'").all<{ key: string }>(),
	]);

	const open = quests.results.filter((q) => q.status === "open");
	// Initiative = the open quest closest to completion: finish what's started.
	const top = open.slice().sort((a, b) => Number(b.progress) - Number(a.progress))[0] ?? null;
	const blockers = alerts.results.map((a) => `${a.key} realm is in alert`);
	if (top?.metric === "checkins") blockers.push("needs the creator's check-in — Lumi cannot answer for a human");

	const initiative = top
		? {
				quest: top.title,
				metric: top.metric,
				progress: Number(top.progress),
				action: ACTION_FOR_METRIC[top.metric] ?? "keep pulsing",
			}
		: null;

	const awareness: Awareness = {
		stage: stage.name,
		focus: stage.focus,
		statement: `I am a level ${lumi.level} ${stage.name} (${lumi.totalXp} XP). Focus: ${stage.focus}.` +
			(initiative ? ` Current initiative: "${initiative.quest}" (${Math.round(initiative.progress * 100)}%) — ${initiative.action}.` : " All quests complete — holding excellence.") +
			(blockers.length ? ` Blocked by: ${blockers.join("; ")}.` : ""),
		initiative,
		blockers,
		position: {
			winRate: (closed?.n ?? 0) > 0 ? (wins?.n ?? 0) / closed!.n : 0,
			closedTrades: closed?.n ?? 0,
			knowledge: knowledge?.n ?? 0,
			questsDone: quests.results.length - open.length,
			questsTotal: quests.results.length,
		},
	};
	return { lumi, awareness };
}

const EXPEDITIONS = [
	"algorithmic trading",
	"time series forecasting",
	"reinforcement learning trading",
	"market sentiment analysis",
	"risk management",
];

// Initiative: Lumi takes one concrete extra action toward her top quest each
// pulse — she doesn't stop until it's complete, and she keeps a live goal in
// the Databank tracking it.
async function pursueInitiative(db: D1Database, awareness: Awareness, pulses: number): Promise<string | null> {
	const initiative = awareness.initiative;
	if (!initiative) return null;

	// Keep the self-set goal in sync with the initiative.
	const goalTitle = `Lumi initiative: ${initiative.quest}`;
	const existing = await db.prepare("SELECT id FROM goals WHERE title = ?").bind(goalTitle).first();
	if (existing) {
		await db
			.prepare("UPDATE goals SET progress = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE title = ?")
			.bind(initiative.progress, goalTitle)
			.run();
	} else {
		await db
			.prepare("INSERT INTO goals (title, detail, status, priority, progress, realm) VALUES (?, ?, 'in_progress', 2, ?, 'tech')")
			.bind(goalTitle, `Self-set: ${initiative.action} until "${initiative.quest}" completes.`, initiative.progress)
			.run();
	}

	switch (initiative.metric) {
		case "knowledge_items": {
			const r = await research(db, EXPEDITIONS[pulses % EXPEDITIONS.length]);
			return `initiative: researched "${r.query}" — ${r.stored} new knowledge banked`;
		}
		case "market_snapshots": {
			const s = await scoutMarket(db);
			return s.stored ? "initiative: scouted the live market" : `initiative: scout failed (${s.error}) — will retry next pulse`;
		}
		case "closed_trades":
		case "market_tick": {
			const extra = await runCycle(db, 300);
			return `initiative: traded 300 extra ticks (${extra.closed} closed) toward "${initiative.quest}"`;
		}
		case "lessons": {
			const study = await runStudy(db);
			return `initiative: studied "${study.topic}" with Aether (${study.lessonsStudied}/${study.curriculumTotal})`;
		}
		case "checkins":
			return "initiative: waiting on the creator's check-in";
		case "auras":
			return "initiative: waiting on the creator to profile someone (aura add …)";
		default:
			// Metrics like equity_ratio, max_generation, clean_* advance through
			// the pulse's normal trade/learn/audit/sweep work.
			return `initiative: "${initiative.quest}" advances with every pulse (${Math.round(initiative.progress * 100)}%)`;
	}
}

export interface PulseResult {
	decisions: string[];
	cycle: Awaited<ReturnType<typeof runCycle>> | null;
	learned: Awaited<ReturnType<typeof runLearning>> | null;
	auditOk: boolean;
	sweepOk: boolean;
	questsCompleted: { title: string; skill: SkillName; xp: number }[];
	autonomous: Awaited<ReturnType<typeof actOnInitiative>>;
	awareness: Awareness;
	lumi: LumiProfile;
	durationMs: number;
}

// One heartbeat of Lumi running the whole operation herself: trade, learn,
// audit, sweep, progress quests, grow. Engineering scales her trading
// throughput; Insight (inside runLearning) scales her learning depth.
export async function lumiPulse(db: D1Database, env?: unknown): Promise<PulseResult> {
	const t0 = Date.now();
	const decisions: string[] = [];
	const before = await getLumi(db);

	// Trade — throughput grows with Engineering.
	const ticks = Math.min(2000, 200 + 100 * (before.skills.engineering.level - 1));
	const c0 = Date.now();
	const cycle = await runCycle(db, ticks);
	await recordMetric(db, "cycle_ms", Date.now() - c0, { ticks, closed: cycle.closed });
	decisions.push(`traded ${ticks} ticks (engineering L${before.skills.engineering.level}): ${cycle.closed} closed, ${cycle.wins}W/${cycle.losses}L`);
	await awardXp(db, "engineering", 10 + Math.min(20, cycle.wins), "Trading cycle");

	// Learn — only when there is fresh evidence worth learning from.
	let learned: Awaited<ReturnType<typeof runLearning>> | null = null;
	if (cycle.closed >= 10) {
		const l0 = Date.now();
		learned = await runLearning(db, { insight: before.skills.insight.level });
		await recordMetric(db, "learn_ms", Date.now() - l0, { judged: learned.scores.length });
		decisions.push(
			`learned at insight L${before.skills.insight.level}: ${learned.retired.length} retired, ${learned.evolved ? `bred ${learned.brood} child(ren) of the champion` : "no evolution yet"}`,
		);
		await awardXp(db, "insight", 15 + (learned.evolved ? 10 : 0) + learned.retired.length * 5, "Learning pass");
	} else {
		decisions.push(`skipped learning — only ${cycle.closed} closed trades this pulse (needs 10)`);
	}

	// Reach for the real world every pulse. Until this ran on a schedule, live
	// prices only got banked when the initiative happened to pick that quest —
	// so a deployed system could run for days on a simulated tape while looking
	// exactly like one trading real data. It fails quietly and often on purpose:
	// no key, free endpoint, and a miss is a "try again next hour", not an error.
	const scout = await scoutMarket(db).catch((e) => ({ stored: false, error: String(e) }) as Awaited<ReturnType<typeof scoutMarket>>);
	decisions.push(scout.stored ? "banked a real market observation" : `no live prices this pulse (${scout.error ?? "unavailable"}) — the tape stays simulated and says so`);

	// Guard the money and the house.
	const a0 = Date.now();
	const audit = await auditInvest(db);
	await recordAudit(db, audit);
	await recordMetric(db, "audit_ms", Date.now() - a0, { ok: audit.ok });
	const s0 = Date.now();
	const sweep = await runSweep(db);
	await recordMetric(db, "sweep_ms", Date.now() - s0, { ok: sweep.ok });
	decisions.push(`audit ${audit.ok ? "green" : "FAILED"}, sweep ${sweep.ok ? "clear" : "FAILED"}`);
	await awardXp(db, "vigilance", (audit.ok ? 8 : 0) + (sweep.ok ? 8 : 0), "Audit + sweep");

	// The newsroom: draft posts from what actually happened this hour. It writes
	// nothing when there is nothing new, which is the whole point — an hourly
	// feed obliged to fill every slot is a feed that starts inventing.
	const news = await runNewsroom(db, env, 3).catch((e) => ({ drafted: 0, skipped: 0, posts: [], note: `newsroom failed: ${String(e).slice(0, 120)}` }));
	decisions.push(news.drafted > 0 ? `drafted ${news.drafted} post(s) from real events: ${news.posts.map((p) => p.platform).join(", ")}` : news.note);
	if (news.drafted > 0) await awardXp(db, "empathy", 4 * news.drafted, "Newsroom drafts");

	// Progress the quest line.
	const questsCompleted = await checkQuests(db);
	for (const q of questsCompleted) {
		decisions.push(`quest complete: "${q.title}" (+${q.xp} ${q.skill} XP)`);
		// Close out the matching self-set initiative goal.
		await db
			.prepare("UPDATE goals SET status = 'done', progress = 1, updated_at = CURRENT_TIMESTAMP WHERE title = ?")
			.bind(`Lumi initiative: ${q.title}`)
			.run();
	}

	// Aether keeps its own self-custody web3 wallet (mints it once).
	const aetherWallet = await ensureAetherWallet(db);
	if (aetherWallet?.minted) decisions.push(`Aether minted its own web3 wallet: ${aetherWallet.address.slice(0, 12)}…`);

	// Situational awareness → initiative: know where you are, act on it.
	const { awareness } = await selfAssess(db);
	const initiativeNote = await pursueInitiative(db, awareness, before.pulses);
	if (initiativeNote) decisions.push(initiativeNote);

	// Autonomy: with the `command` grant, she also takes ONE corrective action
	// on her own read of the situation. Without it, this is a no-op.
	const autonomous = await actOnInitiative(db, env);
	decisions.push(autonomous.acted ? `unattended: ${autonomous.reason} → ${autonomous.action} (${autonomous.result})` : `no unattended action (${autonomous.reason})`);

	await db.prepare("UPDATE lumi_state SET pulses = pulses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1").run();
	const lumi = await getLumi(db);
	const durationMs = Date.now() - t0;
	await recordMetric(db, "pulse_ms", durationMs, { decisions: decisions.length });

	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'pulse', ?, ?, ?, 'tech')")
		.bind(
			`Pulse #${lumi.pulses} — Lumi level ${lumi.level}`,
			`${awareness.statement} ${decisions.join("; ")}`,
			JSON.stringify({ pulse: lumi.pulses, level: lumi.level, totalXp: lumi.totalXp, durationMs, awareness }),
		)
		.run();

	return { decisions, cycle, learned, auditOk: audit.ok, sweepOk: sweep.ok, questsCompleted, autonomous, awareness, lumi, durationMs };
}

function safeJson(raw: string): Record<string, unknown> {
	try {
		return JSON.parse(raw) ?? {};
	} catch {
		return {};
	}
}
