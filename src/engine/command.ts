// TOTAL COMMAND — every capability Lumi can exercise, in one registry, behind
// one natural-language command bar. Jarvis-style: you speak, she routes, she
// acts, she reports.
//
// Three honest rules:
//   1. Every capability declares the AUTHORITY SCOPE it needs. If the creator
//      hasn't granted that scope, Lumi refuses and says which grant is missing.
//      Nothing bypasses the ledger.
//   2. Routing is deterministic first (keyword match on real capability verbs).
//      Claude is consulted only to disambiguate when linked, and its choice is
//      still validated against the registry — a model can never invent a
//      capability or escalate a scope.
//   3. Every command is recorded in orchestrator_tasks, granted or refused.
//
// Boundary, stated plainly: this runs in a Cloudflare Worker. Lumi commands
// everything INSIDE this system — she has no filesystem, shell, or OS access,
// and cannot control the creator's computer. That would require an agent
// running on their machine.

import { dispatch, convene, type DispatchResult } from "./orchestrator";
import { runCycle } from "./trader";
import { runLearning } from "./learning";
import { auditInvest, recordAudit } from "./integrity";
import { runSweep } from "./guardian";
import { runStudy } from "./training";
import { runScan } from "./shield";
import { research, scoutMarket } from "./knowledge";
import { transfer } from "./token";
import { setHalt } from "./risk";
import { localOverview, queueTask } from "./local";

export type Scope = "observe" | "operate" | "spend" | "publish" | "command" | "machine";

export interface Authority {
	scope: Scope;
	granted: boolean;
	detail: string;
}

export async function getAuthority(db: D1Database): Promise<Authority[]> {
	const rows = (
		await db.prepare("SELECT scope, granted, detail FROM authority ORDER BY rowid").all<{ scope: Scope; granted: number; detail: string }>()
	).results;
	return rows.map((r) => ({ scope: r.scope, granted: r.granted === 1, detail: r.detail }));
}

export async function setAuthority(db: D1Database, scope: string, granted: boolean): Promise<Authority | { error: string }> {
	const row = await db.prepare("SELECT scope FROM authority WHERE scope = ?").bind(scope).first<{ scope: string }>();
	if (!row) return { error: `unknown scope: ${scope}` };
	await db.prepare("UPDATE authority SET granted = ?, updated_at = CURRENT_TIMESTAMP WHERE scope = ?").bind(granted ? 1 : 0, scope).run();
	const all = await getAuthority(db);
	return all.find((a) => a.scope === scope)!;
}

async function hasScope(db: D1Database, scope: Scope): Promise<boolean> {
	const row = await db.prepare("SELECT granted FROM authority WHERE scope = ?").bind(scope).first<{ granted: number }>();
	return row?.granted === 1;
}

// ---- The registry: everything Lumi can do ----

export interface Capability {
	id: string;
	scope: Scope;
	realm: string;
	summary: string;
	// Words that route a plain-English order here. First match wins, longest first.
	triggers: string[];
	run: (ctx: { db: D1Database; env: unknown; order: string }) => Promise<string>;
}

// Pull the first number out of an order ("run 500 ticks" → 500).
function num(order: string, fallback: number): number {
	const m = order.match(/\b(\d{1,6})\b/);
	return m ? Number(m[1]) : fallback;
}
// Everything after the trigger word, for free-text arguments.
function rest(order: string, trigger: string): string {
	const i = order.toLowerCase().indexOf(trigger);
	return i < 0 ? order.trim() : order.slice(i + trigger.length).trim();
}

export const CAPABILITIES: Capability[] = [
	{
		id: "trade",
		scope: "operate",
		realm: "invest",
		summary: "Run a trading cycle (take-profit / stop-loss managed per tick)",
		triggers: ["run a cycle", "trade", "run cycle", "cycle"],
		run: async ({ db, order }) => {
			const c = await runCycle(db, num(order, 200));
			return `traded ${c.ticks} ticks: ${c.closed} closed (${c.wins}W/${c.losses}L), net ${c.totalPnl.toFixed(2)}, equity ${c.colonyEquity.toFixed(2)}`;
		},
	},
	{
		id: "learn",
		scope: "operate",
		realm: "invest",
		summary: "Score strategies on evidence, retire losers, evolve the champion",
		triggers: ["learn", "evolve", "score strategies"],
		run: async ({ db }) => {
			const l = await runLearning(db, { insight: 1 });
			return `scored ${l.scores.length} strategies, retired ${l.retired.length}, ${l.evolved ? "evolved the champion" : "no evolution this pass"}`;
		},
	},
	{
		id: "audit",
		scope: "observe",
		realm: "invest",
		summary: "Audit the invest ledger (reconciliation + 4 integrity checks)",
		triggers: ["audit", "check the ledger", "reconcile"],
		run: async ({ db }) => {
			const a = await auditInvest(db);
			await recordAudit(db, a);
			return `audit ${a.ok ? "green" : "FAILED"} — ${a.checks.length} checks`;
		},
	},
	{
		id: "sweep",
		scope: "operate",
		realm: "guardian",
		summary: "Guardian sweep: databank, ledger, privacy, heartbeats, continuity",
		triggers: ["sweep", "guard", "protect"],
		run: async ({ db }) => {
			const s = await runSweep(db);
			return `sweep ${s.ok ? "clear" : "FAILED"}`;
		},
	},
	{
		id: "scan",
		scope: "operate",
		realm: "shield",
		summary: "Red-team security scan: posture score + findings",
		triggers: ["scan", "red team", "red-team", "security"],
		run: async ({ db, env }) => {
			const p = await runScan(db, env);
			return `posture ${p.score}/100 (${p.grade}) across ${p.dimensions.length} dimensions`;
		},
	},
	{
		id: "study",
		scope: "operate",
		realm: "invest",
		summary: "Study the next lesson in the trading curriculum",
		triggers: ["study", "train", "school"],
		run: async ({ db }) => {
			const s = await runStudy(db);
			return `studied "${s.topic}" (${s.lessonsStudied}/${s.curriculumTotal})`;
		},
	},
	{
		id: "research",
		scope: "operate",
		realm: "tech",
		summary: "Expedition to public sources; bank what she finds as knowledge",
		triggers: ["research", "look into", "find out about"],
		run: async ({ db, order }) => {
			const q = rest(order, "research") || rest(order, "look into") || "algorithmic trading";
			const r = await research(db, q);
			return `researched "${r.query}" — ${r.stored} new knowledge banked`;
		},
	},
	{
		id: "scout",
		scope: "operate",
		realm: "invest",
		summary: "Scout live market prices from the outside world",
		triggers: ["scout", "market snapshot", "prices"],
		run: async ({ db }) => {
			const s = await scoutMarket(db);
			return s.stored ? "scouted the live market" : `scout failed (${s.error})`;
		},
	},
	{
		id: "halt",
		scope: "operate",
		realm: "invest",
		summary: "Halt all trading — capital stops going out immediately",
		triggers: ["halt", "stop trading", "emergency stop", "freeze"],
		run: async ({ db }) => {
			await setHalt(db, true, "commanded by the creator");
			return "TRADING HALTED — open positions are managed, no new ones opened";
		},
	},
	{
		id: "resume",
		scope: "operate",
		realm: "invest",
		summary: "Resume trading after a halt",
		triggers: ["resume", "unhalt", "start trading"],
		run: async ({ db }) => {
			await setHalt(db, false, "resumed by the creator");
			return "trading resumed";
		},
	},
	{
		id: "pay",
		scope: "spend",
		realm: "invest",
		summary: "Move AETHER between accounts (requires the spend grant)",
		triggers: ["pay", "send aether", "transfer"],
		run: async ({ db, order }) => {
			// "pay lumi 250" — target then amount.
			const m = order.match(/(?:pay|send aether|transfer)\s+([a-z0-9\-]+)\s+(\d+(?:\.\d+)?)/i);
			if (!m) return "could not read the payment — say it like: pay lumi 250";
			const r = await transfer(db, "treasury", m[1], Number(m[2]), "command", "commanded by the creator");
			return "error" in r ? `refused: ${r.error}` : `paid ${m[2]} AETHER to ${m[1]} from the treasury`;
		},
	},
	{
		id: "pulse",
		scope: "operate",
		realm: "tech",
		summary: "Lumi's full heartbeat: trade → learn → audit → sweep → quests",
		triggers: ["pulse", "heartbeat", "do your rounds", "run everything"],
		run: async ({ db, env }) => {
			const r = await dispatch(db, env, "lumi", "commanded pulse");
			return "error" in r ? r.error : r.result;
		},
	},
	{
		id: "ask",
		scope: "observe",
		realm: "tech",
		summary: "Ask a model for counsel (Claude when linked)",
		triggers: ["ask claude", "ask", "advise", "counsel"],
		run: async ({ db, env, order }) => {
			const q = rest(order, "ask claude") || rest(order, "ask") || order;
			const r = await dispatch(db, env, "claude", q || "status");
			return "error" in r ? r.error : r.result;
		},
	},
	{
		id: "machine",
		scope: "machine",
		realm: "tech",
		summary: "Queue work for the agent on the creator's own computer",
		triggers: ["on my machine", "on my computer", "local:", "machine:"],
		run: async ({ db, env, order }) => {
			// Strip a leading separator so "on my machine: git status" yields the
			// bare command, not ": git status".
			const t = (rest(order, "on my machine") || rest(order, "on my computer") || rest(order, "local:") || rest(order, "machine:"))
				.replace(/^[:,\-—\s]+/, "")
				.trim();
			if (!t) return "say what to do, e.g. `on my machine: git status`";
			const status = await localOverview(db, env);
			const task = await queueTask(db, t);
			return status.linked
				? `queued for your machine (task #${task.id}): ${t} — the local agent decides whether to run it.`
				: `queued (task #${task.id}), but no machine is linked yet: set LOCAL_AGENT_SECRET and run agent/lumi-agent.mjs.`;
		},
	},
	{
		id: "council",
		scope: "observe",
		realm: "tech",
		summary: "Put one directive to every model at once and compare counsel",
		triggers: ["council", "convene", "ask everyone", "ask all"],
		run: async ({ db, env, order }) => {
			const q = rest(order, "council") || rest(order, "convene") || order;
			const c = await convene(db, env, q || "status");
			return c.verdict;
		},
	},
];

// ---- Routing ----

export interface CommandResult {
	order: string;
	capability: string | null;
	scope: Scope | null;
	status: "done" | "refused" | "unrouted" | "failed";
	result: string;
}

// Deterministic route: longest trigger that appears in the order wins. No model
// needed, no ambiguity — the same order always routes the same way.
export function route(order: string): Capability | null {
	const o = order.toLowerCase();
	let best: { cap: Capability; len: number } | null = null;
	for (const cap of CAPABILITIES) {
		for (const t of cap.triggers) {
			if (o.includes(t) && (!best || t.length > best.len)) best = { cap, len: t.length };
		}
	}
	return best ? best.cap : null;
}

// Execute a plain-English order: route it, check the grant, run it, log it.
export async function command(db: D1Database, env: unknown, order: string): Promise<CommandResult> {
	const cap = route(order);
	if (!cap) {
		const out: CommandResult = {
			order,
			capability: null,
			scope: null,
			status: "unrouted",
			result: `No capability matches that order. Lumi can: ${CAPABILITIES.map((c) => c.id).join(", ")}.`,
		};
		await logCommand(db, out);
		return out;
	}

	if (!(await hasScope(db, cap.scope))) {
		const out: CommandResult = {
			order,
			capability: cap.id,
			scope: cap.scope,
			status: "refused",
			result: `"${cap.id}" needs the ${cap.scope.toUpperCase()} grant, which you haven't given. Grant it in the command deck to authorize this.`,
		};
		await logCommand(db, out);
		return out;
	}

	try {
		const result = await cap.run({ db, env, order });
		const out: CommandResult = { order, capability: cap.id, scope: cap.scope, status: "done", result };
		await logCommand(db, out);
		return out;
	} catch (err) {
		const out: CommandResult = { order, capability: cap.id, scope: cap.scope, status: "failed", result: String(err) };
		await logCommand(db, out);
		return out;
	}
}

async function logCommand(db: D1Database, r: CommandResult): Promise<void> {
	await db
		.prepare("INSERT INTO orchestrator_tasks (target, kind, directive, status, result) VALUES (?, 'command', ?, ?, ?)")
		.bind(r.capability ?? "unrouted", r.order, r.status === "done" ? "done" : r.status === "refused" ? "offline" : "failed", r.result.slice(0, 2000))
		.run();
}

export async function commandOverview(db: D1Database) {
	return {
		authority: await getAuthority(db),
		capabilities: CAPABILITIES.map((c) => ({ id: c.id, scope: c.scope, realm: c.realm, summary: c.summary, triggers: c.triggers })),
		boundary:
			"Lumi commands everything inside this system. She runs in a Cloudflare Worker — no filesystem, shell, or OS access, so she cannot control your computer. That needs an agent running on your machine.",
	};
}
