// The local-agent bridge. Lumi queues a task; the agent running on the
// creator's machine claims it, decides whether to run it, and reports back.
//
// Two independent gates, and BOTH must open:
//   1. Lumi needs the `machine` authority scope to queue anything at all.
//   2. The local agent must be running, hold the shared secret, and accept the
//      task (allowlist + confirmation). The machine always has the veto.
//
// The Worker never executes anything. It is a queue and a record, nothing more.

export interface LocalTask {
	id: number;
	task: string;
	status: string;
	result: string;
	host: string;
	created_at: string;
}

export function agentSecret(env: unknown): string {
	const v = (env as Record<string, unknown> | null | undefined)?.LOCAL_AGENT_SECRET;
	return typeof v === "string" ? v : "";
}

// Lumi queues work for the machine. Returns the task as queued.
export async function queueTask(db: D1Database, task: string): Promise<LocalTask> {
	const row = await db
		.prepare("INSERT INTO local_tasks (task) VALUES (?) RETURNING id, task, status, result, host, created_at")
		.bind(task)
		.first<LocalTask>();
	return row!;
}

// The agent claims the oldest queued task. Returns null when there's nothing
// to do — the agent then simply waits and polls again.
export async function claimNext(db: D1Database, host: string): Promise<LocalTask | null> {
	const next = await db.prepare("SELECT id FROM local_tasks WHERE status = 'queued' ORDER BY id LIMIT 1").first<{ id: number }>();
	if (!next) return null;
	const row = await db
		.prepare(
			"UPDATE local_tasks SET status = 'claimed', host = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'queued' RETURNING id, task, status, result, host, created_at",
		)
		.bind(host, next.id)
		.first<LocalTask>();
	return row ?? null;
}

// The agent reports what happened — including a refusal, which is a first-class
// outcome, not an error. A machine saying "no" is the system working.
export async function completeTask(
	db: D1Database,
	id: number,
	status: "done" | "failed" | "refused",
	result: string,
): Promise<LocalTask | { error: string }> {
	const row = await db
		.prepare(
			"UPDATE local_tasks SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id, task, status, result, host, created_at",
		)
		.bind(status, result.slice(0, 4000), id)
		.first<LocalTask>();
	if (!row) return { error: `unknown task: ${id}` };
	return row;
}

export interface LocalOverview {
	linked: boolean;
	note: string;
	pending: number;
	tasks: LocalTask[];
}

// Honest status: "linked" means the operator configured a shared secret. It
// does NOT claim an agent is currently running — the recent-task timestamps
// show that, and we don't dress up a silent queue as a live connection.
export async function localOverview(db: D1Database, env: unknown): Promise<LocalOverview> {
	const configured = agentSecret(env).length > 0;
	const [pending, tasks] = await Promise.all([
		db.prepare("SELECT COUNT(*) as n FROM local_tasks WHERE status IN ('queued','claimed')").first<{ n: number }>(),
		db.prepare("SELECT id, task, status, result, host, created_at FROM local_tasks ORDER BY id DESC LIMIT 8").all<LocalTask>(),
	]);
	return {
		linked: configured,
		note: configured
			? "Shared secret set. Run agent/lumi-agent.mjs on your machine to pick up queued work."
			: "Not linked — set LOCAL_AGENT_SECRET and run agent/lumi-agent.mjs on your machine to give Lumi hands.",
		pending: pending?.n ?? 0,
		tasks: tasks.results,
	};
}
