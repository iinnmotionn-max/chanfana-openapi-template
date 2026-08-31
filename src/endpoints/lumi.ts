// Lumi's own endpoints: her profile/quest log and her autonomous pulse.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { lumiPulse, perfSummary, selfAssess } from "../engine/lumi";
import { watchIntegrity } from "../engine/appintegrity";
import { automationHealth, recordRun } from "../engine/automation";
import { research, scoutMarket } from "../engine/knowledge";
import { curriculumStatus, runStudy } from "../engine/training";

export class LumiStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "Lumi's profile: level, skills, quests, and engine performance",
		responses: {
			"200": {
				description: "Lumi's living state",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const db = c.env.DB;
		const [assessed, quests, perf] = await Promise.all([
			selfAssess(db),
			db.prepare("SELECT * FROM quests ORDER BY status = 'done', id").all(),
			perfSummary(db),
		]);
		return { success: true, result: { ...assessed.lumi, awareness: assessed.awareness, quests: quests.results, perf } };
	}
}

export class LumiPulse extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "One heartbeat of Lumi running everything: trade, learn, audit, sweep, quests, XP",
		responses: {
			"200": {
				description: "What Lumi decided and how she grew",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const t0 = Date.now();
		const result = await lumiPulse(c.env.DB, c.env);
		// Same structural watch the cron runs — a manual pulse should notice
		// drift too, not only the unattended one.
		const integrity = await watchIntegrity(c.env.DB, c.env);
		result.decisions.push(integrity.note);
		// Recorded as manual/autopilot, never as cron — a pulse someone fired
		// by hand must not make a dead schedule look alive.
		const src = c.req.query("source") === "autopilot" ? "autopilot" : "manual";
		await recordRun(c.env.DB, "pulse", src, true, `${result.decisions.length} decisions`, Date.now() - t0);
		return { success: true, result: { ...result, integrity, automation: await automationHealth(c.env.DB) } };
	}
}

export class LumiResearch extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "Send Lumi on a research expedition: Hugging Face models + datasets",
		request: {
			body: contentJson(
				z.object({
					query: z.string().min(1).max(200),
				}),
			),
		},
		responses: {
			"200": {
				description: "What Lumi found and banked",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await research(c.env.DB, body.query);
		return { success: true, result };
	}
}

export class LumiScout extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "Scout a live market snapshot from the real world (CoinGecko, free)",
		responses: {
			"200": {
				description: "Live prices banked as knowledge",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const result = await scoutMarket(c.env.DB);
		return { success: true, result };
	}
}

export class LumiTrain extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "Study session: Lumi & Aether study the Invest trading curriculum",
		responses: {
			"200": {
				description: "What was studied and how they grew",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const result = await runStudy(c.env.DB);
		return { success: true, result };
	}
}

export class LumiCurriculum extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "The trading curriculum and how much of it Aether has taught",
		responses: {
			"200": {
				description: "Curriculum progress",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await curriculumStatus(c.env.DB) };
	}
}

export class KnowledgeList extends OpenAPIRoute {
	public schema = {
		tags: ["Lumi"],
		summary: "The knowledge bank: everything Lumi has gathered from outside",
		request: {
			query: z.object({
				limit: z.coerce.number().int().min(1).max(200).default(50),
			}),
		},
		responses: {
			"200": {
				description: "Knowledge entries, newest first",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { query } = await this.getValidatedData<typeof this.schema>();
		const { results } = await c.env.DB.prepare("SELECT * FROM knowledge ORDER BY id DESC LIMIT ?")
			.bind(query.limit)
			.all();
		return { success: true, result: results };
	}
}
