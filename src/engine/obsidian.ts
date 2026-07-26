// OBSIDIAN EXPORT — Lumi's records as a linked markdown vault.
//
// Everything this system knows lives in D1: reports she filed, realms she
// watches, goals she is pushing, quests she is working, integrity and security
// findings. That is the right home for it — but it is queryable only through
// this app, which makes it useless the moment you want to think alongside it,
// search it next to your own notes, or keep it after the Worker is gone.
//
// So it exports as plain markdown with Obsidian's conventions: YAML
// frontmatter, [[wikilinks]] between notes, #tags. Nothing here is
// Obsidian-only — it is markdown, readable in any editor, and readable in ten
// years when none of this is running.
//
// ON THE VAULT ID, plainly: an Obsidian vault id is a LOCAL identifier. There
// is no public API that lets a server write into your vault because it knows
// one, and Sync/Publish need an account and their own credentials. So
// OBSIDIAN_VAULT_ID here is a LABEL, stamped into the frontmatter so exported
// notes can be traced to the vault they belong in. It is not a credential, it
// grants this system access to nothing, and no amount of setting it will make
// these notes appear in your vault by themselves — you copy them in. Anything
// else would be a claim this code cannot honour.

import { getLumi } from "./lumi";

export interface VaultNote {
	path: string; // relative path inside the vault
	content: string;
}

export interface VaultExport {
	vaultId: string | null;
	notes: VaultNote[];
	counts: Record<string, number>;
	truncated: { kind: string; shown: number; total: number }[];
	note: string;
}

// Per-collection caps. A vault export should not depend on how long the colony
// has been running, and a 40MB JSON response helps nobody. Anything dropped is
// REPORTED — a silent truncation reads as "you have everything".
const LIMITS = { reports: 200, checks: 100 };

function yaml(v: string): string {
	// Quote anything YAML would misread, and never let a quote break the block.
	return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// Obsidian filenames cannot contain these, and a collision is worse than a
// slightly uglier name.
function safeName(s: string, fallback: string): string {
	const cleaned = String(s || "")
		.replace(/[\\/:*?"<>|#^[\]]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
	return cleaned || fallback;
}

function frontmatter(fields: Record<string, string | string[] | number | null>): string {
	const lines = ["---"];
	for (const [k, v] of Object.entries(fields)) {
		if (v === null || v === undefined) continue;
		if (Array.isArray(v)) lines.push(`${k}: [${v.map((x) => yaml(x)).join(", ")}]`);
		else if (typeof v === "number") lines.push(`${k}: ${v}`);
		else lines.push(`${k}: ${yaml(v)}`);
	}
	lines.push("---", "");
	return lines.join("\n");
}

function readEnv(env: unknown, key: string): string {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" ? v : "";
}

export async function buildVault(db: D1Database, env: unknown): Promise<VaultExport> {
	const vaultId = readEnv(env, "OBSIDIAN_VAULT_ID") || null;
	const truncated: VaultExport["truncated"] = [];

	const [reports, reportTotal, realms, goals, quests, checks, checkTotal, lumi] = await Promise.all([
		db
			.prepare("SELECT id, author, kind, title, body, realm, created_at FROM reports ORDER BY id DESC LIMIT ?")
			.bind(LIMITS.reports)
			.all<{ id: number; author: string; kind: string; title: string; body: string; realm: string | null; created_at: string }>(),
		db.prepare("SELECT COUNT(*) as n FROM reports").first<{ n: number }>(),
		db.prepare("SELECT key, title, mission, status FROM realms ORDER BY id").all<{ key: string; title: string; mission: string; status: string }>(),
		db.prepare("SELECT title, detail, status, priority, progress, realm FROM goals ORDER BY priority, id").all<{ title: string; detail: string; status: string; priority: number; progress: number; realm: string | null }>(),
		db.prepare("SELECT title, detail, skill, xp_reward, status FROM quests ORDER BY id").all<{ title: string; detail: string; skill: string; xp_reward: number; status: string }>(),
		db
			.prepare("SELECT realm, name, status, detail, created_at FROM checks ORDER BY id DESC LIMIT ?")
			.bind(LIMITS.checks)
			.all<{ realm: string; name: string; status: string; detail: string; created_at: string }>(),
		db.prepare("SELECT COUNT(*) as n FROM checks").first<{ n: number }>(),
		// Level and XP are derived from the skills JSON, not stored columns.
		getLumi(db),
	]);

	if ((reportTotal?.n ?? 0) > LIMITS.reports) truncated.push({ kind: "reports", shown: reports.results.length, total: reportTotal!.n });
	if ((checkTotal?.n ?? 0) > LIMITS.checks) truncated.push({ kind: "checks", shown: checks.results.length, total: checkTotal!.n });

	const notes: VaultNote[] = [];
	const stamp = { vault: vaultId, source: "Lumi Colony" };

	// --- The index. A vault whose front door is a file list is a folder; the
	// point of this format is that a human lands somewhere that explains itself.
	const realmLinks = realms.results.map((r) => `- [[${safeName(r.title, r.key)}]] — ${r.mission.split(".")[0]}. Status: **${r.status}**`).join("\n");
	notes.push({
		path: "Lumi/Lumi.md",
		content:
			frontmatter({ ...stamp, title: "Lumi", tags: ["lumi", "index"] }) +
			`# Lumi\n\n` +
			`Level ${lumi.level} · ${lumi.totalXp} XP · ${lumi.pulses} pulses.\n\n` +
			`## Realms\n\n${realmLinks || "_none yet_"}\n\n` +
			`## Sections\n\n- [[Goals]]\n- [[Quests]]\n- [[Checks]]\n- Reports are filed under \`Lumi/Reports/\`.\n\n` +
			`> Exported from a running Lumi Colony. Every number here was recorded by the system, not written by hand.\n`,
	});

	// --- Every report as its own note, so it is searchable and linkable.
	//
	// Report titles repeat constantly — "Pulse #4", "Invest audit: ledger green"
	// — and two notes with the same path means the second silently overwrites
	// the first the moment they are copied into a vault. Losing records during
	// an export whose entire purpose is keeping them would be the worst possible
	// bug here, so a collision gets the report id appended.
	const usedNames = new Set<string>();
	const reportNames = new Map<number, string>();
	for (const r of reports.results) {
		let name = safeName(r.title, `report-${r.id}`);
		if (usedNames.has(name.toLowerCase())) name = `${name} (${r.id})`;
		usedNames.add(name.toLowerCase());
		reportNames.set(r.id, name);
		notes.push({
			path: `Lumi/Reports/${name}.md`,
			content:
				frontmatter({
					...stamp,
					title: r.title,
					author: r.author,
					kind: r.kind,
					realm: r.realm ?? "",
					created: r.created_at,
					tags: ["report", r.kind, r.author],
				}) +
				`# ${r.title}\n\n${r.body}\n\n---\n\nFiled by **${r.author}** · ${r.created_at}` +
				(r.realm ? ` · realm [[${safeName(realms.results.find((x) => x.key === r.realm)?.title ?? r.realm, r.realm)}]]` : "") +
				`\n\nBack to [[Lumi]].\n`,
		});
	}

	// --- One note per realm, linking to its own reports. Built AFTER the report
	// notes so the links use the same de-duplicated names — a wikilink to a name
	// that does not exist is a dead link, which is worse than no link.
	const realmNotes: VaultNote[] = [];
	for (const r of realms.results) {
		const mine = reports.results.filter((x) => x.realm === r.key);
		realmNotes.push({
			path: `Lumi/${safeName(r.title, r.key)}.md`,
			content:
				frontmatter({ ...stamp, title: r.title, realm: r.key, status: r.status, tags: ["realm", r.key] }) +
				`# ${r.title}\n\n${r.mission}\n\nStatus: **${r.status}**\n\n` +
				`## Reports\n\n${mine.length ? mine.map((x) => `- [[${reportNames.get(x.id)}]]`).join("\n") : "_none in this export_"}\n\n` +
				`Back to [[Lumi]].\n`,
		});
	}

	notes.push(...realmNotes);

	// --- Goals and quests as tables: they are lists, and a note per row would
	// bury the shape of the roadmap in a folder.
	notes.push({
		path: "Lumi/Goals.md",
		content:
			frontmatter({ ...stamp, title: "Goals", tags: ["goals"] }) +
			`# Goals\n\n| Goal | Status | Progress | Realm |\n|---|---|---|---|\n` +
			goals.results
				.map((g) => `| ${g.title} | ${g.status} | ${Math.round(g.progress * 100)}% | ${g.realm ?? "—"} |`)
				.join("\n") +
			`\n\nBack to [[Lumi]].\n`,
	});
	notes.push({
		path: "Lumi/Quests.md",
		content:
			frontmatter({ ...stamp, title: "Quests", tags: ["quests"] }) +
			`# Quests\n\n` +
			quests.results.map((q) => `- [${q.status === "done" ? "x" : " "}] **${q.title}** — ${q.detail} _(+${q.xp_reward} ${q.skill})_`).join("\n") +
			`\n\nBack to [[Lumi]].\n`,
	});
	notes.push({
		path: "Lumi/Checks.md",
		content:
			frontmatter({ ...stamp, title: "Checks", tags: ["checks"] }) +
			`# Checks\n\nThe most recent ${checks.results.length} recorded checks.\n\n| When | Realm | Check | Status | Detail |\n|---|---|---|---|---|\n` +
			checks.results
				.map((c) => `| ${c.created_at} | ${c.realm} | ${c.name} | ${c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌"} ${c.status} | ${c.detail.replace(/\|/g, "\\|").slice(0, 160)} |`)
				.join("\n") +
			`\n\nBack to [[Lumi]].\n`,
	});

	return {
		vaultId,
		notes,
		counts: {
			notes: notes.length,
			reports: reports.results.length,
			realms: realms.results.length,
			goals: goals.results.length,
			quests: quests.results.length,
			checks: checks.results.length,
		},
		truncated,
		note:
			"Markdown only — copy these files into your vault. An Obsidian vault id is a local identifier, not a credential: this system cannot write into your vault, and setting OBSIDIAN_VAULT_ID only stamps the notes so you can tell where they belong." +
			(truncated.length ? ` Capped for size: ${truncated.map((t) => `${t.kind} ${t.shown}/${t.total}`).join(", ")}.` : ""),
	};
}
