// Growth v2 endpoints: connectors, deals pipeline, and campaign analytics.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import {
	advanceDeal,
	campaignAnalytics,
	connect,
	connectorStatus,
	createDeal,
	dealsPipeline,
	growthxOverview,
	publishPost,
	STAGES,
} from "../engine/growthx";

export class ConnectorsList extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Posting connectors and whether each is live (credentials present)",
		responses: { "200": { description: "Connectors", ...contentJson({ success: z.boolean(), result: z.array(z.any()) }) } },
	};
	public async handle(c: AppContext) {
		return { success: true, result: await connectorStatus(c.env.DB, c.env) };
	}
}

export class ConnectorConnect extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Link a posting account (still needs its API secret to post for real)",
		request: {
			body: contentJson(z.object({ platform: z.enum(["x", "linkedin", "instagram", "blog"]), handle: z.string().max(80).default("") })),
		},
		responses: {
			"200": { description: "Connected", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Unknown platform" },
		},
	};
	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const r = await connect(c.env.DB, body.platform, body.handle);
		if ("error" in r) return c.json({ success: false, errors: [{ code: 4004, message: r.error }] }, 400);
		return { success: true, result: r };
	}
}

export class PostPublish extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Publish a post — really posts if the connector is live, else local",
		request: { params: z.object({ id: z.coerce.number().int() }) },
		responses: {
			"200": { description: "Publish result", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"404": { description: "Post not found" },
		},
	};
	public async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const r = await publishPost(c.env.DB, c.env, params.id);
		if ("error" in r) return c.json({ success: false, errors: [{ code: 4041, message: r.error }] }, 404);
		return { success: true, result: r };
	}
}

export class DealsList extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Partnerships/deals pipeline with weighted value",
		responses: { "200": { description: "Deals", ...contentJson({ success: z.boolean(), result: z.any() }) } },
	};
	public async handle(c: AppContext) {
		return { success: true, result: await dealsPipeline(c.env.DB) };
	}
}

export class DealCreate extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Add a partnership/deal to the pipeline",
		request: {
			body: contentJson(
				z.object({
					name: z.string().min(1),
					partner: z.string().max(120).default(""),
					value: z.number().min(0).default(0),
					probability: z.number().min(0).max(1).default(0.2),
					note: z.string().max(300).default(""),
				}),
			),
		},
		responses: { "201": { description: "The created deal", ...contentJson({ success: z.boolean(), result: z.any() }) } },
	};
	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const deal = await createDeal(c.env.DB, body);
		return c.json({ success: true, result: deal }, 201);
	}
}

export class DealAdvance extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Advance a deal to a new stage",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
			body: contentJson(z.object({ stage: z.enum(STAGES) })),
		},
		responses: {
			"200": { description: "The updated deal", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Invalid stage" },
			"404": { description: "Deal not found" },
		},
	};
	public async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		const r = await advanceDeal(c.env.DB, params.id, body.stage);
		if ("error" in r) return c.json({ success: false, errors: [{ code: 4040, message: r.error }] }, r.error === "deal not found" ? 404 : 400);
		return { success: true, result: r };
	}
}

export class GrowthAnalytics extends OpenAPIRoute {
	public schema = {
		tags: ["Growth"],
		summary: "Campaign analytics, deal pipeline, and connector status in one call",
		responses: { "200": { description: "Analytics", ...contentJson({ success: z.boolean(), result: z.any() }) } },
	};
	public async handle(c: AppContext) {
		const [campaigns, deals, connectors] = await Promise.all([
			campaignAnalytics(c.env.DB),
			dealsPipeline(c.env.DB),
			connectorStatus(c.env.DB, c.env),
		]);
		return { success: true, result: { campaigns, deals, connectors } };
	}
}
