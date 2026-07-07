import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";

export class GoalsList extends OpenAPIRoute {
	public schema = {
		tags: ["Goals"],
		summary: "Colony goals and roadmap",
		responses: {
			"200": {
				description: "Goals ordered by priority",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare(
			"SELECT * FROM goals ORDER BY status = 'done', priority, id",
		).all();
		return { success: true, result: results };
	}
}

export class GoalCreate extends OpenAPIRoute {
	public schema = {
		tags: ["Goals"],
		summary: "Add a goal",
		request: {
			body: contentJson(
				z.object({
					title: z.string().min(1),
					detail: z.string().default(""),
					priority: z.number().int().min(1).max(5).default(3),
				}),
			),
		},
		responses: {
			"201": {
				description: "The created goal",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const goal = await c.env.DB.prepare(
			"INSERT INTO goals (title, detail, priority) VALUES (?, ?, ?) RETURNING *",
		)
			.bind(body.title, body.detail, body.priority)
			.first();
		return c.json({ success: true, result: goal }, 201);
	}
}

export class GoalUpdate extends OpenAPIRoute {
	public schema = {
		tags: ["Goals"],
		summary: "Update a goal's status or progress",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
			body: contentJson(
				z.object({
					status: z.enum(["open", "in_progress", "done"]).optional(),
					progress: z.number().min(0).max(1).optional(),
					detail: z.string().optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "The updated goal",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
			"404": { description: "Goal not found" },
		},
	};

	public async handle(c: AppContext) {
		const { params, body } = await this.getValidatedData<typeof this.schema>();
		const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
		const binds: unknown[] = [];
		for (const key of ["status", "progress", "detail"] as const) {
			if (body[key] !== undefined) {
				sets.push(`${key} = ?`);
				binds.push(body[key]);
			}
		}
		const goal = await c.env.DB.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ? RETURNING *`)
			.bind(...binds, params.id)
			.first();
		if (!goal) return c.json({ success: false, errors: [{ code: 4041, message: "Not Found" }] }, 404);
		return { success: true, result: goal };
	}
}
