// App integrity — the structural self-check. Read it any time; POST a scan to
// record the result into the Databank so drift is tracked over time.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { auditApp, recordAppAudit } from "../engine/appintegrity";
import { probeGuards } from "../engine/probe";
import { assessReadiness } from "../engine/readiness";

export class IntegrityStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Integrity"],
		summary: "Does the code still agree with the database it runs on?",
		responses: {
			"200": { description: "Structural integrity report", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: await auditApp(c.env.DB, c.env) };
	}
}

export class IntegrityProbe extends OpenAPIRoute {
	public schema = {
		tags: ["Integrity"],
		summary: "Red-team the guards: call every locked route anonymously and demand a refusal",
		responses: {
			"200": { description: "Probe report", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		// Probes hit this same Worker over HTTP, so they exercise the real
		// request path — middleware, routing, handler order and all. A guard
		// that only exists in the source but not in the served route would
		// pass a source review and fail here, which is the whole point.
		const report = await probeGuards(new URL(c.req.url).origin, c.env);
		if (!report.ok) {
			await c.env.DB.prepare(
				"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('guardian', 'integrity', ?, ?, ?, 'guardian')",
			)
				.bind(
					`UNGUARDED ROUTE — ${report.holes.length} of ${report.probed} locked routes answered an anonymous caller`,
					report.holes.map((h) => `${h.route}: ${h.note}`).join("\n"),
					JSON.stringify(report),
				)
				.run();
		}
		for (const r of report.results) {
			await c.env.DB.prepare("INSERT INTO checks (realm, name, status, detail) VALUES ('guardian', ?, ?, ?)")
				.bind(`guard:${r.route}`, r.guarded ? "pass" : "fail", r.note)
				.run();
		}
		return { success: true, result: report };
	}
}

export class IntegrityScan extends OpenAPIRoute {
	public schema = {
		tags: ["Integrity"],
		summary: "Run the structural audit and chronicle it (checks + a report)",
		responses: {
			"200": { description: "Recorded integrity report", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const audit = await auditApp(c.env.DB, c.env);
		await recordAppAudit(c.env.DB, audit);
		return { success: true, result: audit };
	}
}

export class ReadinessStatus extends OpenAPIRoute {
	public schema = {
		tags: ["Integrity"],
		summary: "What is wired, what isn't, and the exact command for each gap",
		responses: {
			"200": { description: "Readiness report", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		return { success: true, result: assessReadiness(c.env) };
	}
}
