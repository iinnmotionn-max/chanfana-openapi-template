// Aura endpoints: profile the people the colony works FOR — never the creator.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { AURA_KINDS, composeBrief } from "../engine/aura";
import { awardXp } from "../engine/lumi";

export class AuraList extends OpenAPIRoute {
	public schema = {
		tags: ["Auras"],
		summary: "All auras (personality + design profiles)",
		responses: {
			"200": {
				description: "Auras",
				...contentJson({ success: z.boolean(), result: z.array(z.any()) }),
			},
		},
	};

	public async handle(c: AppContext) {
		const { results } = await c.env.DB.prepare("SELECT * FROM auras ORDER BY id DESC").all();
		return {
			success: true,
			result: results.map((a) => ({ ...a, traits: JSON.parse(String(a.traits || "{}")), consent: Boolean(a.consent) })),
		};
	}
}

export class AuraCreate extends OpenAPIRoute {
	public schema = {
		tags: ["Auras"],
		summary: "Profile a client, brand, user, or investor — consent-gated, never the creator",
		request: {
			body: contentJson(
				z.object({
					name: z.string().min(1).max(120),
					kind: z.enum(AURA_KINDS),
					personality: z.string().max(200).default(""),
					traits: z.record(z.string()).default({}),
					notes: z.string().max(1000).default(""),
					consent: z.boolean().default(false),
				}),
			),
		},
		responses: {
			"201": {
				description: "The stored aura with its personalization brief",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
			"400": { description: "Privacy rule violated" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		// Hard privacy rules: the creator is never profiled, and free-text
		// notes are stored only with explicit consent.
		if (/\bcreator\b/i.test(body.name)) {
			return c.json(
				{ success: false, errors: [{ code: 4031, message: "The creator is never profiled — aura refused" }] },
				400,
			);
		}
		if (body.notes.length > 0 && !body.consent) {
			return c.json(
				{ success: false, errors: [{ code: 4032, message: "Notes require consent=true — store nothing personal without permission" }] },
				400,
			);
		}
		const aura = await c.env.DB.prepare(
			"INSERT INTO auras (name, kind, personality, traits, notes, consent) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
		)
			.bind(body.name, body.kind, body.personality, JSON.stringify(body.traits), body.notes, body.consent ? 1 : 0)
			.first();
		// Understanding people is Empathy's craft.
		await awardXp(c.env.DB, "empathy", 15, `Aura profiled: ${body.name}`);
		await c.env.DB.prepare(
			"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'aura', ?, ?, ?, 'wellness')",
		)
			.bind(
				`Aura profiled: ${body.name}`,
				`${body.kind} · ${body.personality || "personality unknown"} · consent ${body.consent ? "given" : "not given (no notes stored)"}`,
				JSON.stringify({ kind: body.kind }),
			)
			.run();
		return c.json(
			{ success: true, result: { ...aura, traits: body.traits, brief: composeBrief(body.personality, body.traits) } },
			201,
		);
	}
}

export class AuraBrief extends OpenAPIRoute {
	public schema = {
		tags: ["Auras"],
		summary: "Personalization brief: how Lumi should design and communicate for this aura",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
		},
		responses: {
			"200": {
				description: "Design + communication brief",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
			"404": { description: "Aura not found" },
		},
	};

	public async handle(c: AppContext) {
		const { params } = await this.getValidatedData<typeof this.schema>();
		const aura = await c.env.DB.prepare("SELECT * FROM auras WHERE id = ?").bind(params.id).first();
		if (!aura) return c.json({ success: false, errors: [{ code: 4041, message: "Not Found" }] }, 404);
		const traits = JSON.parse(String(aura.traits || "{}"));
		return {
			success: true,
			result: {
				id: aura.id,
				name: aura.name,
				kind: aura.kind,
				personality: aura.personality,
				brief: composeBrief(String(aura.personality || ""), traits),
			},
		};
	}
}
