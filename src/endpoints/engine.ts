import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { runCycle } from "../engine/trader";
import { runLearning } from "../engine/learning";

export class EngineRun extends OpenAPIRoute {
	public schema = {
		tags: ["Engine"],
		summary: "Run a trading cycle: advance the market, every active bot trades",
		request: {
			body: contentJson(
				z.object({
					ticks: z.number().int().min(1).max(2000).default(200),
				}),
			),
		},
		responses: {
			"200": {
				description: "Cycle result",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const result = await runCycle(c.env.DB, body.ticks);
		return { success: true, result };
	}
}

export class EngineLearn extends OpenAPIRoute {
	public schema = {
		tags: ["Engine"],
		summary: "Run a learning cycle: score, retire losers, evolve the champion",
		responses: {
			"200": {
				description: "Learning result",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const result = await runLearning(c.env.DB);
		return { success: true, result };
	}
}
