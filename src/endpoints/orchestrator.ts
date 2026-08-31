// The Orchestrator API — Lumi's command chair. GET shows the roster of every
// intelligence she commands (agents + models, with honest link status) and the
// recent task log; POST dispatches a directive to one of them.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { convene, dispatch, orchestratorOverview } from "../engine/orchestrator";

export class OrchestratorStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Orchestrator"],
		summary: "Lumi's command roster: every agent & model, link status, recent tasks",
		responses: {
			"200": { description: "Roster + task log", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await orchestratorOverview(c.env.DB, c.env) };
	}
}

export class OrchestratorDispatch extends OpenAPIRoute {
	public schema = {
		tags: ["Orchestrator"],
		summary: "Lumi dispatches a directive to one intelligence (agent or model)",
		request: {
			body: contentJson(
				z.object({
					target: z.string().min(1).max(40),
					directive: z.string().min(1).max(2000).default("status"),
				}),
			),
		},
		responses: {
			"200": { description: "Dispatch result", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Unknown intelligence" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await dispatch(c.env.DB, c.env, body.target, body.directive);
		if ("error" in result) {
			return c.json({ success: false, errors: [{ code: 4005, message: result.error }] }, 400);
		}
		return { success: true, result };
	}
}

export class OrchestratorCouncil extends OpenAPIRoute {
	public schema = {
		tags: ["Orchestrator"],
		summary: "Convene the council: put one directive to every model at once",
		request: {
			body: contentJson(z.object({ directive: z.string().min(1).max(2000).default("status") })),
		},
		responses: {
			"200": { description: "Every model's answer + Lumi's verdict", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		return { success: true, result: await convene(c.env.DB, c.env, body.directive) };
	}
}
