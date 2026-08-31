import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Everything Lumi records lives in D1, which makes it queryable only through
// this app — useless the moment you want to think alongside it, search it next
// to your own notes, or keep it after the Worker is gone. This exports it as
// plain markdown. The failure that would matter most is losing records during
// an export whose entire purpose is keeping them.

const VAULT_ID = "b3eb17c55ee39515";

async function vault() {
	const res = await SELF.fetch("http://local.test/obsidian/export");
	return ((await res.json()) as any).result;
}

describe("Obsidian export — records you can keep", () => {
	it("builds a linked vault from real recorded rows", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		await SELF.fetch("http://local.test/lumi/pulse", { method: "POST" });
		const v = await vault();

		expect(v.counts.notes).toBeGreaterThan(5);
		expect(v.notes.find((n: any) => n.path === "Lumi/Lumi.md"), "an index to land on").toBeTruthy();
		expect(v.notes.some((n: any) => n.path.startsWith("Lumi/Reports/")), "reports are exported").toBe(true);
	});

	it("never writes two notes to the same path — that would silently lose records", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		// Repeated titles are the normal case: pulses and audits all look alike.
		for (let i = 0; i < 4; i++) await SELF.fetch("http://local.test/realms/invest/audit", { method: "POST" });
		const v = await vault();

		const paths = v.notes.map((n: any) => n.path);
		const dupes = paths.filter((p: string, i: number) => paths.indexOf(p) !== i);
		expect(dupes, `duplicate note paths would overwrite each other in a vault: ${dupes.join(", ")}`).toEqual([]);
	});

	it("every wikilink points at a note that exists", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		await SELF.fetch("http://local.test/realms/invest/audit", { method: "POST" });
		const v = await vault();

		// A note's link target is its filename without the .md.
		const names = new Set(v.notes.map((n: any) => n.path.split("/").pop()!.replace(/\.md$/, "")));
		const dead: string[] = [];
		for (const n of v.notes) {
			for (const m of n.content.matchAll(/\[\[([^\]]+)\]\]/g)) {
				if (!names.has(m[1])) dead.push(`${n.path} → [[${m[1]}]]`);
			}
		}
		expect(dead, `dead wikilinks: ${dead.slice(0, 5).join(", ")}`).toEqual([]);
	});

	it("stamps the vault id without ever claiming it grants access", async () => {
		const v = await vault();
		expect(v.vaultId).toBe(VAULT_ID);
		expect(v.notes[0].content).toContain(VAULT_ID);
		// The honest limit has to travel with the payload, not sit in a README.
		expect(v.note).toContain("not a credential");
		expect(v.note).toContain("cannot write into your vault");
	});

	it("produces valid YAML frontmatter even when a title contains quotes", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		const v = await vault();
		for (const n of v.notes) {
			expect(n.content.startsWith("---\n"), `${n.path} opens with frontmatter`).toBe(true);
			const fm = n.content.slice(4, n.content.indexOf("\n---\n", 3));
			// An unescaped quote would break the block and Obsidian would show
			// the raw YAML at the top of the note.
			for (const line of fm.split("\n")) {
				const quotes = (line.match(/(?<!\\)"/g) || []).length;
				expect(quotes % 2, `${n.path}: unbalanced quotes in "${line}"`).toBe(0);
			}
		}
	});

	it("reports what it capped instead of silently truncating", async () => {
		const v = await vault();
		expect(Array.isArray(v.truncated)).toBe(true);
		expect(v.note).toContain("copy these files into your vault");
	});

	it("serves one pasteable markdown file too, with paths preserved", async () => {
		await SELF.fetch("http://local.test/colony/seed", { method: "POST" });
		const res = await SELF.fetch("http://local.test/obsidian/export?format=markdown");
		expect(res.headers.get("Content-Type")).toContain("text/markdown");
		const body = await res.text();
		expect(body).toContain("<!-- FILE: Lumi/Lumi.md -->");
		expect(body).toContain("# Lumi");
	});

	it("the manifest is cheap — paths and counts, no bodies", async () => {
		const res = await SELF.fetch("http://local.test/obsidian");
		const m = ((await res.json()) as any).result;
		expect(m.paths.length).toBe(m.counts.notes);
		expect(m.bytes).toBeGreaterThan(0);
		expect(JSON.stringify(m).length, "manifest is far smaller than the export").toBeLessThan(20000);
	});

	it("appears in readiness as optional, with the limit stated", async () => {
		const r = ((await (await SELF.fetch("http://local.test/ready")).json()) as any).result;
		const item = r.items.find((i: any) => i.envKey === "OBSIDIAN_VAULT_ID");
		expect(item.need).toBe("optional");
		expect(item.note).toContain("not a credential");
	});
});
