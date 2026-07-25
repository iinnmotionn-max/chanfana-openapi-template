// App integrity — the structural self-check. Read it any time; POST a scan to
// record the result into the Databank so drift is tracked over time.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { auditApp, recordAppAudit } from "../engine/appintegrity";

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
