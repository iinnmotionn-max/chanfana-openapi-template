# Lumi's local agent — giving her hands on your machine

The Worker can't touch your computer. It runs in a Cloudflare sandbox: no
filesystem, no shell, no OS. So when you tell Lumi *"on my machine: git status"*,
she **queues** the task — and this small program, which **you** run on your own
computer, decides whether to actually do it.

Two gates, both must open:

1. **Lumi needs the `machine` grant.** Click it in the command deck. Without it
   she refuses to queue anything at all.
2. **This agent must accept the task.** Allowlist, no shell, your confirmation.
   The machine always holds the veto.

## Setup

**1 — Set the shared secret on the Worker** (your machine, Git Bash):

```bash
npx wrangler secret put LOCAL_AGENT_SECRET
# paste a long random string
npx wrangler deploy
```

**2 — Put the same secret in your shell**, and start the agent:

```bash
export LUMI_AGENT_SECRET='the-same-string'
node agent/lumi-agent.mjs --url https://YOUR-WORKER.workers.dev --workdir .
```

On Windows PowerShell: `$env:LUMI_AGENT_SECRET='the-same-string'`

**3 — Grant the scope**: open `/dash`, click the **machine** chip in the
Authority row until it turns green.

**4 — Command her**: type into the Jarvis bar —

```
on my machine: git status
```

The agent prints the request, waits for your **y/N**, runs it, and the output
comes back into the cockpit.

## What it will and won't do

| Rule | Why |
|---|---|
| **Allowlist only** — `git`, `npm`, `npx`, `node`, `ls`, `cat`, `echo`, `pwd`, `date`, `wrangler`, `python`… | Anything else is refused and reported as refused. Edit `ALLOW` in the script to widen it. |
| **No eval flags** — `node -e`, `python -c`, `--eval`, `-p`, `-i` are refused | An allowlist of program *names* is only as strong as the programs on it. `node -e "…"` is arbitrary code execution wearing an approved name, so the flag is refused, not just the program. |
| **No task runners** — `npm run`, `npm install`, `npx exec`, `yarn test`… are refused | They execute whatever the local project defines, which an allowlist cannot vet. Run the underlying command directly. |
| **No shell** — commands are spawned directly | `;` `&&` `\|` backticks and redirection can't chain a second command. A task containing them is refused outright. |
| **Confirmation on every task** | You see it before it runs. `--yes` skips the prompt — only use it when you trust the queue. |
| **Sandboxed to `--workdir`** | Commands run there, not wherever the agent was launched from. |
| **60s timeout, 4000-char output cap** | A runaway task can't hang or flood the log. |

## Straight talk

**The allowlist is a speed bump, not a sandbox.** A security review of this
agent found that `node -e`, `python -c`, and `npm run` sailed straight through
the original allowlist — arbitrary code execution under an approved program
name. Those are closed now, but the lesson generalizes: any program that can
evaluate a string or run a project-defined script defeats a name-based
allowlist. **If you widen `ALLOW`, check whether the program you're adding can
do that**, and add its eval flag to `EVAL_FLAGS` if so.

The real boundary is the **confirmation prompt** — a human reading each command
before it runs. `--yes` removes it. Treat that flag as "I trust every task that
will ever land in this queue."

This is remote execution on your own machine, and no set of rules makes that
risk-free. Run it on a machine you're willing to have act on these commands, in
a directory you chose, and read the confirmations. `--yes` removes the last
human check — think before using it. Stop the agent with **Ctrl+C** and Lumi's
hands are gone; the queue just sits there until you start it again.

Everything queued, claimed, run, or refused is recorded in the Databank and
visible in the cockpit.
