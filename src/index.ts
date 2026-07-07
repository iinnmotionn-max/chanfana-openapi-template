import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { AgentsList, ColonySeed } from "./endpoints/colony";
import { BotCreate, BotsList, BotUpdate } from "./endpoints/bots";
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
import { KnowledgeList, LumiPulse, LumiResearch, LumiScout, LumiStatus } from "./endpoints/lumi";
import { AuraBrief, AuraCreate, AuraList } from "./endpoints/auras";
import { RiskConfig, RiskHalt, RiskResume, RiskStatusEndpoint } from "./endpoints/risk";
import { MarketFeed, MarketList } from "./endpoints/market";
import { dashHtml } from "./dash";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Runs for every route. Setting the header AFTER `await next()` guarantees it
// lands on the final response, so live API + dashboard are never served stale.
app.use("*", async (c, next) => {
	await next();
	// Live data + dashboard must never be served stale from a cache.
	c.header("Cache-Control", "no-store, must-revalidate");
});

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
openapi.patch("/bots/:id", BotUpdate);
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

// Lumi herself: profile, quests, pulse, and expeditions into the world
openapi.get("/lumi", LumiStatus);
openapi.post("/lumi/pulse", LumiPulse);
openapi.post("/lumi/research", LumiResearch);
openapi.post("/lumi/scout", LumiScout);
openapi.get("/knowledge", KnowledgeList);

// Aura layer: personality + design profiles (consent-gated, never the creator)
openapi.get("/auras", AuraList);
openapi.post("/auras", AuraCreate);
openapi.get("/auras/:id/brief", AuraBrief);

// Realms — Lumi's four domains
openapi.get("/realms", RealmsList);
openapi.post("/realms/invest/audit", InvestAudit);
openapi.post("/realms/guardian/sweep", GuardianSweep);
openapi.get("/realms/tech/status", TechStatus);
openapi.get("/realms/wellness", WellnessSummary);
openapi.post("/realms/wellness/checkin", WellnessCheckin);

// Risk gates for capital — drawdown/exposure limits + global halt
openapi.get("/risk", RiskStatusEndpoint);
openapi.post("/risk/halt", RiskHalt);
openapi.post("/risk/resume", RiskResume);
openapi.patch("/risk/config", RiskConfig);

// Market feed — switch a symbol between the sim tape and the live feed
openapi.get("/market", MarketList);
openapi.post("/market/feed", MarketFeed);

// Analytics (feeds the cockpit)
openapi.get("/analytics/overview", AnalyticsOverview);

// Scheduled autonomy: on a Cron Trigger firing, Lumi pulses herself —
// trades, learns, audits, sweeps, pursues her initiative — unattended.
import { lumiPulse } from "./engine/lumi";

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(lumiPulse(env.DB));
	},
};
