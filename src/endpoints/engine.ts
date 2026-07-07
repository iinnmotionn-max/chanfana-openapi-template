import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { runCycle } from "../engine/trader";
import { runLearning } from "../engine/learning";
import { getLumi, recordMetric } from "../engine/lumi";

export class EngineRun extends OpenAPIRoute {
	public schema = {
		tags: ["Engine"],
		summary: "Run a trading cycle: advance the market, every active bot trades. Set learn=true to run a learning pass in the same call (active advancement learning).",
		request: {
			body: contentJson(
				z.object({
					ticks: z.number().int().min(1).max(2000).default(200),
					learn: z.boolean().default(false),
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
		const t0 = Date.now();
		const result = await runCycle(c.env.DB, body.ticks);
		await recordMetric(c.env.DB, "cycle_ms", Date.now() - t0, { ticks: body.ticks, closed: result.closed });
		// Active advancement learning: trade and learn in one call, at Lumi's
		// current insight level.
		let learned = null;
		if (body.learn) {
			const lumi = await getLumi(c.env.DB);
			const l0 = Date.now();
			learned = await runLearning(c.env.DB, { insight: lumi.skills.insight.level });
			await recordMetric(c.env.DB, "learn_ms", Date.now() - l0, { judged: learned.scores.length });
		}
		return { success: true, result: { ...result, learned } };
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
		const lumi = await getLumi(c.env.DB);
		const t0 = Date.now();
		const result = await runLearning(c.env.DB, { insight: lumi.skills.insight.level });
		await recordMetric(c.env.DB, "learn_ms", Date.now() - t0, { judged: result.scores.length });
		return { success: true, result };
	}
}
