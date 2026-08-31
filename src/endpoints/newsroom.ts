// The newsroom — what the system would post about right now, and drafting it.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { gatherNews, runNewsroom } from "../engine/newsroom";

export class NewsroomStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "What is newsworthy right now, and what has already been covered",
		responses: {
			"200": { description: "Newsworthy events", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const events = await gatherNews(c.env.DB, c.env);
		const covered = new Set(
			(await c.env.DB.prepare("SELECT DISTINCT event_key FROM posts WHERE event_key != ''").all<{ event_key: string }>()).results.map((r) => r.event_key),
		);
		return {
			success: true,
			result: {
				events: events.map((e) => ({ ...e, covered: covered.has(e.key) })),
				fresh: events.filter((e) => !covered.has(e.key)).length,
				note: "Every fact here is read from a recorded row. Drafting happens on the hourly pulse; a quiet hour drafts nothing.",
			},
		};
	}
}

export class NewsroomRunNow extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Draft posts from the freshest real events now (they stay drafts)",
		request: { body: contentJson(z.object({ max: z.number().int().min(1).max(6).default(3) })) },
		responses: {
			"200": { description: "What it drafted", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return { success: true, result: await runNewsroom(c.env.DB, c.env, body.max) };
	}
}
