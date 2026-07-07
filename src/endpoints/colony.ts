import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { seedColony } from "../engine/colony";

export class ColonySeed extends OpenAPIRoute {
	public schema = {
		tags: ["Colony"],
		summary: "Birth the starter colony (idempotent)",
		responses: {
			"200": {
				description: "Colony seed result",
				...contentJson({
					success: z.boolean(),
					result: z.object({
						created: z.boolean(),
						strategies: z.number(),
						bots: z.number(),
					}),
				}),
			},
		},
	};

	public async handle(c: AppContext) {
		const result = await seedColony(c.env.DB);
		return { success: true, result };
	}
}

export class AgentsList extends OpenAPIRoute {
	public schema = {
		tags: ["Colony"],
		summary: "The colony's core agents and their DNA",
		responses: {
			"200": {
				description: "Agent registry",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare("SELECT id, name, role, dna, status, last_seen FROM agents ORDER BY id").all();
		return { success: true, result: results.map((a) => ({ ...a, dna: JSON.parse(String(a.dna)) })) };
	}
}
