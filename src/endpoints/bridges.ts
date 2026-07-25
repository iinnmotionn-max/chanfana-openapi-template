// Who has been through the inbound doors, and which of them you vouch for.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { callerRoster, setCallerTrust } from "../engine/callers";
import { rotationStatus } from "../engine/rotation";

export class BridgeCallers extends OpenAPIRoute {
	public schema = {
		tags: ["Integrity"],
		summary: "Every caller seen on each inbound bridge, plus rotation state",
		responses: {
			"200": { description: "Caller roster", ...contentJson({ success: z.boolean(), result: z.any() }) },
		},
	};

	public async handle(c: AppContext) {
		const callers = await callerRoster(c.env.DB);
		return {
			success: true,
			result: {
				callers,
				unknown: callers.filter((x) => !x.trusted).length,
				rotation: await rotationStatus(c.env.DB, c.env),
				// Said in the payload, not just the docs: this is the one claim a
				// reader might otherwise assume the data supports.
				note: "Caller names are self-reported by the client. This shows who SAYS they are calling — useful for spotting an unfamiliar machine, useless as authentication.",
			},
		};
	}
}

export class BridgeTrust extends OpenAPIRoute {
	public schema = {
		tags: ["Integrity"],
		summary: "Vouch for a caller (or take it back)",
		request: {
			body: contentJson(
				z.object({
					bridge: z.string().max(40),
					caller: z.string().max(80),
					trusted: z.boolean().default(true),
				}),
			),
		},
		responses: {
			"200": { description: "The updated caller", ...contentJson({ success: z.boolean(), result: z.any() }) },
			"400": { description: "No such caller on that bridge" },
		},
	};

	public async handle(c: AppContext) {
		const { body } = await this.getValidatedData<typeof this.schema>();
		const res = await setCallerTrust(c.env.DB, body.bridge, body.caller, body.trusted);
		if ("error" in res) {
			return c.json({ success: false, errors: [{ code: 4044, message: res.error }] }, 400);
		}
		return { success: true, result: res };
	}
}
