import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { AgentsList, ColonySeed } from "./endpoints/colony";
import { BotCreate, BotsList } from "./endpoints/bots";
import { EngineLearn, EngineRun } from "./endpoints/engine";
import { ReportsList, StrategiesList, TradesList } from "./endpoints/records";
import { GoalCreate, GoalsList, GoalUpdate } from "./endpoints/goals";
import { AnalyticsOverview } from "./endpoints/analytics";
import {
	GuardianSweep,
	InvestAudit,
	RealmsList,
	TechStatus,
	WellnessCheckin,
	WellnessSummary,
} from "./endpoints/realms";
import { dashHtml } from "./dash";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
	if (err instanceof ApiException) {
		// If it's a Chanfana ApiException, let Chanfana handle the response
		return c.json(
			{ success: false, errors: err.buildResponse() },
			err.status as ContentfulStatusCode,
		);
	}

	console.error("Global error handler caught:", err); // Log the error if it's not known

	// For other errors, return a generic 500 response
	return c.json(
		{
			success: false,
			errors: [{ code: 7000, message: "Internal Server Error" }],
		},
		500,
	);
});

// Lumi — the creator dashboard (plain HTML, outside the OpenAPI registry)
app.get("/dash", (c) => c.html(dashHtml));

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
	schema: {
		info: {
			title: "Lumi Colony API",
			version: "1.0.0",
			description:
				"Reg's API for the Lumi colony: a self-improving paper-trading system. " +
				"Seed the colony, run cycles, let the Observer learn from every trade. Dashboard at /dash.",
		},
	},
});

// Colony
openapi.post("/colony/seed", ColonySeed);
openapi.get("/agents", AgentsList);

// Bots & strategies
openapi.get("/bots", BotsList);
openapi.post("/bots", BotCreate);
openapi.get("/strategies", StrategiesList);

// Engine
openapi.post("/engine/run", EngineRun);
openapi.post("/engine/learn", EngineLearn);

// Databank reads
openapi.get("/trades", TradesList);
openapi.get("/reports", ReportsList);

// Goals
openapi.get("/goals", GoalsList);
openapi.post("/goals", GoalCreate);
openapi.patch("/goals/:id", GoalUpdate);

// Realms — Lumi's four domains
openapi.get("/realms", RealmsList);
openapi.post("/realms/invest/audit", InvestAudit);
openapi.post("/realms/guardian/sweep", GuardianSweep);
openapi.get("/realms/tech/status", TechStatus);
openapi.get("/realms/wellness", WellnessSummary);
openapi.post("/realms/wellness/checkin", WellnessCheckin);

// Analytics (feeds the cockpit)
openapi.get("/analytics/overview", AnalyticsOverview);

// Export the Hono app
export default app;
