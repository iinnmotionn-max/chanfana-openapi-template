// Growth endpoints: PR, content, and lead-gen. Lumi drafts marketing copy the
// creator reviews, groups it into campaigns, and hunts curated opportunities.
//
// Honesty boundary (also enforced in the engine): posts are DRAFTS. Marking a
// post 'published' flips a LOCAL flag only — no social account is connected, so
// nothing is posted to a real network. Lead scouting is curated & offline.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import {
	addLead,
	createCampaign,
	draftPost,
	growthOverview,
	PLATFORMS,
	scoutOpportunities,
	setPostStatus,
} from "../engine/growth";

export class GrowthOverview extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Growth realm: campaigns, post pipeline, lead pipeline, and funnel",
		responses: {
			"200": { description: "Growth overview", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await growthOverview(c.env.DB) };
	}
}

export class GrowthDraft extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Draft a platform-tuned marketing post (a DRAFT for the creator to review)",
		request: {
			body: contentJson(
				z.object({
					platform: z.enum(PLATFORMS),
					topic: z.string().max(200).default("Lumi + AETHER launch"),
					campaignId: z.number().int().optional(),
				}),
			),
		},
		responses: {
			"201": { description: "The drafted post", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const post = await draftPost(c.env.DB, {
			platform: body.platform,
			topic: body.topic,
			campaignId: body.campaignId,
		});
		return c.json({ success: true, result: post }, 201);
	}
}

export class GrowthPostStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Move a draft through the pipeline. 'published' is a local flag — not a real post.",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
			body: contentJson(
				z.object({
					status: z.enum(["draft", "queued", "published"]),
				}),
			),
		},
		responses: {
			"200": { description: "The updated post", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"404": { description: "No such post" },
		},
	};

	public async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		const post = await setPostStatus(c.env.DB, params.id, body.status);
		if (!post) {
			return c.json({ success: false, errors: [{ code: 4041, message: "post not found" }] }, 404);
		}
		return { success: true, result: post };
	}
}

export class GrowthPosts extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "All drafted posts, newest first",
		responses: {
			"200": { description: "Posts", ...contentJson({ success: z.boolean(), result: z.array(z.any()) }) },
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare("SELECT * FROM posts ORDER BY id DESC").all();
		return { success: true, result: results };
	}
}

export class GrowthCampaign extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Create a campaign to group posts around one goal",
		request: {
			body: contentJson(
				z.object({
					name: z.string().min(1),
					goal: z.string().max(200).default(""),
				}),
			),
		},
		responses: {
			"201": { description: "The created campaign", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const campaign = await createCampaign(c.env.DB, { name: body.name, goal: body.goal });
		return c.json({ success: true, result: campaign }, 201);
	}
}

export class GrowthLead extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Log a lead / opportunity in the pipeline",
		request: {
			body: contentJson(
				z.object({
					name: z.string().min(1),
					kind: z.enum(["partner", "broker", "placement", "investor", "user", "press"]),
					source: z.string().max(120).default(""),
					value: z.number().min(0).default(0),
					note: z.string().max(300).default(""),
				}),
			),
		},
		responses: {
			"201": { description: "The created lead", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const lead = await addLead(c.env.DB, {
			name: body.name,
			kind: body.kind,
			source: body.source,
			value: body.value,
			note: body.note,
		});
		return c.json({ success: true, result: lead }, 201);
	}
}

export class GrowthLeads extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "All leads / opportunities, newest first",
		responses: {
			"200": { description: "Leads", ...contentJson({ success: z.boolean(), result: z.array(z.any()) }) },
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare("SELECT * FROM leads ORDER BY id DESC").all();
		return { success: true, result: results };
	}
}

export class GrowthScout extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Scout curated opportunities into the pipeline (offline-safe, dedups by name)",
		responses: {
			"200": { description: "Scout result", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await scoutOpportunities(c.env.DB) };
	}
}
