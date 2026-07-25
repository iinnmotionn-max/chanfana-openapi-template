#!/usr/bin/env node
// LUMI'S LOCAL AGENT — her hands on your machine.
//
// This is the ONLY piece that can touch your computer. The Worker can't: it
// runs in a sandbox with no filesystem and no shell. It queues a task; this
// program decides whether to run it. You run this, you own it, you stop it
// with Ctrl+C.
//
//   node agent/lumi-agent.mjs --url https://YOUR-WORKER.workers.dev --workdir .
//
// Requires LUMI_AGENT_SECRET in your environment (same value you set on the
// Worker with `npx wrangler secret put LOCAL_AGENT_SECRET`).
//
// THE RULES THIS PROGRAM ENFORCES — read them before you run it:
//
//   1. ALLOWLIST. Only the commands in ALLOW below can run. Anything else is
//      refused and reported back as refused. Edit the list to widen it; it is
//      deliberately small.
//   2. NO SHELL. Commands are spawned directly, never through a shell, so
//      `;`, `&&`, `|`, backticks and redirection cannot chain a second command.
//      Any task containing shell metacharacters is refused outright.
//   3. CONFIRMATION. Every task is printed and waits for your y/N unless you
//      pass --yes. Default is ask.
//   4. SANDBOXED TO --workdir. Commands run with that as the working directory.
//   5. TIMEOUT + OUTPUT CAP. 60s per task, 4000 chars reported back.
//
// None of this makes remote execution risk-free. Run it on a machine you're
// willing to have act on these commands, in a directory you've chosen, and read
// the confirmations. If you don't want it running, don't start it.

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { hostname } from "node:os";
import { resolve } from "node:path";

// ---- Allowlist: the only executables this agent will run. ----
const ALLOW = new Set([
	"git",
	"npm",
	"npx",
	"node",
	"ls",
	"dir",
	"cat",
	"type",
	"echo",
	"pwd",
	"whoami",
	"date",
	"wrangler",
	"python",
	"python3",
]);

// Shell metacharacters that could chain or redirect. Present → refuse.
const FORBIDDEN = /[;&|`$><\n\r]|\$\(|&&|\|\|/;

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
	const i = args.indexOf(name);
	return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const URL_BASE = (flag("--url") || "").replace(/\/+$/, "");
const WORKDIR = resolve(flag("--workdir", "."));
const AUTO_YES = args.includes("--yes");
const POLL_MS = Number(flag("--interval", "5")) * 1000;
const SECRET = process.env.LUMI_AGENT_SECRET || "";

if (!URL_BASE || !SECRET) {
	console.error("Usage: node agent/lumi-agent.mjs --url https://YOUR-WORKER.workers.dev [--workdir .] [--yes]");
	console.error("       LUMI_AGENT_SECRET must be set in your environment.");
	process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function api(path, body) {
	const res = await fetch(`${URL_BASE}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ secret: SECRET, ...body }),
	});
	if (!res.ok) throw new Error(`${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
	return res.json();
}

// Run one allowlisted command with no shell, bounded time and output.
function run(cmd, argv) {
	return new Promise((done) => {
		const child = spawn(cmd, argv, { cwd: WORKDIR, shell: false });
		let out = "";
		const cap = (d) => {
			if (out.length < 8000) out += d.toString();
		};
		child.stdout.on("data", cap);
		child.stderr.on("data", cap);
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			out += "\n[timed out after 60s]";
		}, 60_000);
		child.on("error", (e) => {
			clearTimeout(timer);
			done({ ok: false, out: String(e) });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			done({ ok: code === 0, out: (out.trim() || `[exit ${code}]`).slice(0, 4000) });
		});
	});
}

async function handle(task) {
	console.log(`\n\x1b[35m▸ Lumi asks:\x1b[0m ${task.task}`);

	if (FORBIDDEN.test(task.task)) {
		console.log("  \x1b[31mrefused\x1b[0m — contains shell metacharacters");
		return { status: "refused", result: "Refused: task contains shell metacharacters (no chaining or redirection allowed)." };
	}

	const parts = task.task.trim().split(/\s+/);
	const cmd = parts[0];
	if (!ALLOW.has(cmd)) {
		console.log(`  \x1b[31mrefused\x1b[0m — "${cmd}" is not on this agent's allowlist`);
		return { status: "refused", result: `Refused: "${cmd}" is not on the allowlist. Allowed: ${[...ALLOW].join(", ")}.` };
	}

	if (!AUTO_YES) {
		const a = (await ask(`  Run in ${WORKDIR}? [y/N] `)).trim().toLowerCase();
		if (a !== "y" && a !== "yes") {
			console.log("  \x1b[33mdeclined\x1b[0m by you");
			return { status: "refused", result: "Refused: the operator declined this task at the machine." };
		}
	}

	const { ok, out } = await run(cmd, parts.slice(1));
	console.log(`  ${ok ? "\x1b[32mdone\x1b[0m" : "\x1b[31mfailed\x1b[0m"}\n${out.split("\n").map((l) => "    " + l).join("\n")}`);
	return { status: ok ? "done" : "failed", result: out };
}

async function main() {
	console.log(`\x1b[35m◈ Lumi local agent\x1b[0m`);
	console.log(`  worker   : ${URL_BASE}`);
	console.log(`  workdir  : ${WORKDIR}`);
	console.log(`  mode     : ${AUTO_YES ? "\x1b[33mauto-approve (--yes)\x1b[0m" : "confirm every task"}`);
	console.log(`  allowlist: ${[...ALLOW].join(", ")}`);
	console.log(`  polling every ${POLL_MS / 1000}s — Ctrl+C to stop. Nothing runs without passing the rules above.\n`);

	for (;;) {
		try {
			const { result: task } = await api("/local/next", { host: hostname() });
			if (task) {
				const outcome = await handle(task);
				await api("/local/result", { id: task.id, ...outcome });
			}
		} catch (e) {
			console.error(`  \x1b[31m!\x1b[0m ${e.message}`);
		}
		await new Promise((r) => setTimeout(r, POLL_MS));
	}
}

main();
