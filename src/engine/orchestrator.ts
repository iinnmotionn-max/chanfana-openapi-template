// The Orchestrator — Lumi in command of every intelligence in the colony,
// Jarvis-style. Two kinds of subordinates:
//
//   AGENTS  — the internal colony (reg, observer, guardian, aether, shield,
//             growth, lumi herself). Dispatching to one runs its REAL action
//             (a trading cycle, a learning pass, a sweep...) — never a stub.
//   MODELS  — external AIs. Claude connects through the Anthropic API and is
//             honest-adapter style: linked only when the operator has set
//             ANTHROPIC_API_KEY; otherwise it reports offline and no call is
//             made. Nothing here fabricates a model response.
//
// Every dispatch lands in orchestrator_tasks so the cockpit shows a live
// command log, and Claude's counsel is banked into `knowledge` permanently.

import Anthropic from "@anthropic-ai/sdk";
import { runCycle } from "./trader";
import { runLearning } from "./learning";
import { auditInvest, recordAudit } from "./integrity";
import { runSweep } from "./guardian";
import { runStudy } from "./training";
import { runScan } from "./shield";
import { scoutOpportunities } from "./growth";
import { lumiPulse } from "./lumi";

function envStr(env: unknown, key: string): string | null {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" && v.length > 0 ? v : null;
}

export interface Intelligence {
	name: string;
	kind: "agent" | "model";
	role: string;
	status: "ready" | "offline";
	detail: string;
}

// The command roster: what Lumi can dispatch, and what each dispatch really does.
const AGENT_ROSTER: { name: string; role: string; detail: string }[] = [
	{ name: "lumi", role: "orchestrator", detail: "full pulse: trade → learn → audit → sweep → quests" },
	{ name: "reg", role: "trader", detail: "runs a 200-tick trading cycle" },
	{ name: "observer", role: "analyst", detail: "learning pass: score, retire, evolve strategies" },
	{ name: "guardian", role: "protector", detail: "security & privacy sweep of the whole system" },
	{ name: "aether", role: "scholar", detail: "studies the next trading lesson" },
	{ name: "shield", role: "red-team", detail: "web3 security scan: posture + findings" },
	{ name: "growth", role: "scout", detail: "hunts leads, partners, and placements" },
];

export const CLAUDE_MODEL = "claude-opus-4-8";
export const HF_MODEL = "meta-llama/Llama-3.3-70B-Instruct";

// Everything Lumi commands, with live link status. A model is 'ready' only
// when the operator has actually provided its API key.
export function intelligenceRoster(env: unknown): Intelligence[] {
	const claudeLinked = envStr(env, "ANTHROPIC_API_KEY") !== null;
	const hfLinked = envStr(env, "HF_TOKEN") !== null;
	return [
		...AGENT_ROSTER.map((a) => ({ ...a, kind: "agent" as const, status: "ready" as const })),
		{
			name: "claude",
			kind: "model",
			role: "counsel",
			status: claudeLinked ? "ready" : "offline",
			detail: claudeLinked
				? `Anthropic API linked · ${CLAUDE_MODEL}`
				: "not linked — set ANTHROPIC_API_KEY to bring Claude online",
		},
		{
			name: "huggingface",
			kind: "model",
			role: "open models",
			status: hfLinked ? "ready" : "offline",
			detail: hfLinked
				? `HF Inference linked · ${HF_MODEL}`
				: "not linked — set HF_TOKEN to bring open models online",
		},
	];
}

export interface DispatchResult {
	target: string;
	kind: "agent" | "model";
	status: "done" | "failed" | "offline";
	result: string;
}

async function logTask(db: D1Database, t: DispatchResult, directive: string): Promise<void> {
	await db
		.prepare("INSERT INTO orchestrator_tasks (target, kind, directive, status, result) VALUES (?, ?, ?, ?, ?)")
		.bind(t.target, t.kind, directive, t.status, t.result.slice(0, 2000))
		.run();
}

// Ask Claude for counsel through the Anthropic API and bank the answer.
async function askClaude(db: D1Database, env: unknown, directive: string): Promise<DispatchResult> {
	const apiKey = envStr(env, "ANTHROPIC_API_KEY");
	if (!apiKey) {
		return {
			target: "claude",
			kind: "model",
			status: "offline",
			result: "Claude is not linked — set ANTHROPIC_API_KEY (wrangler secret put ANTHROPIC_API_KEY) to bring it online.",
		};
	}
	const client = new Anthropic({ apiKey });
	try {
		const response = await client.messages.create({
			model: CLAUDE_MODEL,
			max_tokens: 2048,
			thinking: { type: "adaptive" },
			system:
				"You are Claude, serving as external counsel to Lumi — the orchestrator AI of a paper-trading colony " +
				"with realms for investing, security, growth, and a Roblox city economy. Answer the directive with " +
				"concrete, actionable counsel in a few short paragraphs. No preamble.",
			messages: [{ role: "user", content: directive }],
		});
		const text = response.content
			.filter((b): b is Anthropic.TextBlock => b.type === "text")
			.map((b) => b.text)
			.join("\n")
			.trim();
		// Bank the counsel permanently — knowledge, like every expedition.
		await db
			.prepare("INSERT INTO knowledge (source, kind, title, detail, data) VALUES ('claude', 'counsel', ?, ?, ?)")
			.bind(directive.slice(0, 200), text, JSON.stringify({ model: response.model, usage: response.usage }))
			.run();
		return { target: "claude", kind: "model", status: "done", result: text };
	} catch (err) {
		if (err instanceof Anthropic.APIError) {
			return { target: "claude", kind: "model", status: "failed", result: `Anthropic API error ${err.status}: ${err.message}` };
		}
		return { target: "claude", kind: "model", status: "failed", result: `Claude unreachable: ${String(err)}` };
	}
}

// Ask an open model through the Hugging Face Inference router (OpenAI-compatible
// chat endpoint) and bank the answer. Honest adapter: no HF_TOKEN → offline.
async function askHuggingFace(db: D1Database, env: unknown, directive: string): Promise<DispatchResult> {
	const token = envStr(env, "HF_TOKEN");
	if (!token) {
		return {
			target: "huggingface",
			kind: "model",
			status: "offline",
			result: "Hugging Face is not linked — set HF_TOKEN (wrangler secret put HF_TOKEN) to bring open models online.",
		};
	}
	try {
		const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				model: HF_MODEL,
				max_tokens: 1024,
				messages: [
					{
						role: "system",
						content:
							"You are an open-source model serving as counsel to Lumi, the orchestrator AI of a paper-trading colony. Answer the directive concretely and briefly.",
					},
					{ role: "user", content: directive },
				],
			}),
		});
		if (!res.ok) {
			return { target: "huggingface", kind: "model", status: "failed", result: `HF Inference error ${res.status}: ${(await res.text()).slice(0, 300)}` };
		}
		const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
		const text = (data.choices?.[0]?.message?.content ?? "").trim();
		if (!text) {
			return { target: "huggingface", kind: "model", status: "failed", result: "HF Inference returned an empty response" };
		}
		await db
			.prepare("INSERT INTO knowledge (source, kind, title, detail, data) VALUES ('huggingface', 'counsel', ?, ?, ?)")
			.bind(directive.slice(0, 200), text, JSON.stringify({ model: HF_MODEL }))
			.run();
		return { target: "huggingface", kind: "model", status: "done", result: text };
	} catch (err) {
		return { target: "huggingface", kind: "model", status: "failed", result: `HF unreachable: ${String(err)}` };
	}
}

// Dispatch a directive to one intelligence. Internal agents run their real
// engine action; 'claude' goes out through the API. Unknown target → error.
export async function dispatch(
	db: D1Database,
	env: unknown,
	target: string,
	directive: string,
): Promise<DispatchResult | { error: string }> {
	let out: DispatchResult;
	switch (target) {
		case "lumi": {
			const pulse = await lumiPulse(db);
			out = { target, kind: "agent", status: "done", result: pulse.decisions.join("; ") };
			break;
		}
		case "reg": {
			const c = await runCycle(db, 200);
			out = {
				target,
				kind: "agent",
				status: "done",
				result: `traded 200 ticks: ${c.closed} closed (${c.wins}W/${c.losses}L), net ${c.totalPnl.toFixed(2)}, equity ${c.colonyEquity.toFixed(2)}`,
			};
			break;
		}
		case "observer": {
			const l = await runLearning(db, { insight: 1 });
			out = {
				target,
				kind: "agent",
				status: "done",
				result: `scored ${l.scores.length} strategies, retired ${l.retired.length}, ${l.evolved ? "evolved the champion" : "no evolution this pass"}`,
			};
			break;
		}
		case "guardian": {
			const s = await runSweep(db);
			out = { target, kind: "agent", status: s.ok ? "done" : "failed", result: `sweep ${s.ok ? "clear" : "FAILED"}` };
			break;
		}
		case "aether": {
			const study = await runStudy(db);
			out = { target, kind: "agent", status: "done", result: `studied "${study.topic}" (${study.lessonsStudied}/${study.curriculumTotal})` };
			break;
		}
		case "shield": {
			const scan = await runScan(db, env);
			out = { target, kind: "agent", status: "done", result: `posture ${scan.score}/100 (${scan.grade}) across ${scan.dimensions.length} dimensions` };
			break;
		}
		case "growth": {
			const scout = await scoutOpportunities(db);
			out = { target, kind: "agent", status: "done", result: `scouted ${scout.found} opportunities, ${scout.stored} new to the pipeline` };
			break;
		}
		case "claude": {
			out = await askClaude(db, env, directive);
			break;
		}
		case "huggingface": {
			out = await askHuggingFace(db, env, directive);
			break;
		}
		default:
			return { error: `unknown intelligence: ${target}` };
	}

	// An invest-realm audit follows any money-touching dispatch, same discipline
	// as the pulse: reg trades → the ledger gets audited.
	if (target === "reg" || target === "lumi") {
		const audit = await auditInvest(db);
		await recordAudit(db, audit);
	}

	await logTask(db, out, directive);
	return out;
}

export interface OrchestratorOverview {
	roster: Intelligence[];
	tasks: { target: string; kind: string; directive: string; status: string; result: string; created_at: string }[];
}

export async function orchestratorOverview(db: D1Database, env: unknown): Promise<OrchestratorOverview> {
	const tasks = (
		await db
			.prepare("SELECT target, kind, directive, status, result, created_at FROM orchestrator_tasks ORDER BY id DESC LIMIT 10")
			.all<OrchestratorOverview["tasks"][number]>()
	).results;
	return { roster: intelligenceRoster(env), tasks };
}
