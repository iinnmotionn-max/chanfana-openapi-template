// Shield endpoints: web3 security posture, red-team scans, and privacy-first KYC.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { runScan, shieldOverview, submitKyc } from "../engine/shield";

export class ShieldStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Shield"],
		summary: "Security posture: composite score, dimensions, findings, KYC, web3 link",
		responses: {
			"200": { description: "Shield overview", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await shieldOverview(c.env.DB, c.env) };
	}
}

export class ShieldScan extends OpenAPIRoute {
	public schema = {
		tags: ["Shield"],
		summary: "Run a red-team scan: score every dimension and record findings",
		responses: {
			"200": { description: "Posture after the scan", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await runScan(c.env.DB, c.env) };
	}
}

export class ShieldKyc extends OpenAPIRoute {
	public schema = {
		tags: ["Shield"],
		summary: "Record a privacy-first KYC attestation (level + proof hash, never PII)",
		request: {
			body: contentJson(
				z.object({
					subject: z.string().min(1).max(120),
					level: z.enum(["basic", "verified", "institutional"]),
					method: z.enum(["self", "provider", "zk"]).default("self"),
					attestationHash: z.string().min(8).max(200),
				}),
			),
		},
		responses: {
			"201": { description: "The recorded attestation id", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "Rejected — looks like raw PII, not a hash" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		// Privacy guard: refuse anything that looks like real identity data.
		if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(body.attestationHash) || /\b\d{6,}\b/.test(body.attestationHash)) {
			return c.json({ success: false, errors: [{ code: 4033, message: "attestationHash must be a hash, not PII" }] }, 400);
		}
		const row = await submitKyc(c.env.DB, body.subject, body.level, body.method, body.attestationHash);
		return c.json({ success: true, result: { id: row.id, level: body.level, method: body.method } }, 201);
	}
}
