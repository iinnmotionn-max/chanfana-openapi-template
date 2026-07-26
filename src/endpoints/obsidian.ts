// Lumi's records as a markdown vault you can keep.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { buildVault } from "../engine/obsidian";

export class ObsidianManifest extends OpenAPIRoute {
	public schema = {
		tags: ["Obsidian"],
		summary: "What a vault export would contain (paths and counts, no bodies)",
		responses: {
			"200": { description: "Vault manifest", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const v = await buildVault(c.env.DB, c.env);
		return {
			success: true,
			result: {
				vaultId: v.vaultId,
				counts: v.counts,
				truncated: v.truncated,
				note: v.note,
				paths: v.notes.map((n) => n.path),
				bytes: v.notes.reduce((n, x) => n + x.content.length, 0),
			},
		};
	}
}

export class ObsidianExport extends OpenAPIRoute {
	public schema = {
		tags: ["Obsidian"],
		summary: "Every note in full — JSON by default, or ?format=markdown for one file",
		request: { query: z.object({ format: z.enum(["json", "markdown"]).default("json") }) },
		responses: {
			"200": { description: "Vault export", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const v = await buildVault(c.env.DB, c.env);

		if (query.format === "markdown") {
			// One scrollable document for reading or pasting somewhere fast. The
			// per-file path stays visible so it can still be split back apart.
			const body =
				`<!-- Lumi Colony export. ${v.note} -->\n\n` +
				v.notes.map((n) => `\n\n<!-- FILE: ${n.path} -->\n\n${n.content}`).join("\n---\n");
			return new Response(body, {
				headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="lumi-vault.md"' },
			});
		}
		return { success: true, result: v };
	}
}
