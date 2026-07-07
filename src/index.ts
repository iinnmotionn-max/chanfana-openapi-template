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
import { KnowledgeList, LumiCurriculum, LumiPulse, LumiResearch, LumiScout, LumiStatus, LumiTrain } from "./endpoints/lumi";
import { AuraBrief, AuraCreate, AuraList } from "./endpoints/auras";
import { RiskConfig, RiskHalt, RiskResume, RiskStatusEndpoint } from "./endpoints/risk";
import { MarketFeed, MarketList } from "./endpoints/market";
import {
	AetherAudit,
	AetherChain,
	AetherLedger,
	AetherOverview,
	AetherReward,
	AetherSpend,
	AetherTransfer,
} from "./endpoints/aether";
import { ShieldKyc, ShieldScan, ShieldStatus } from "./endpoints/shield";
import { AetherWallet, WalletCreate, WalletGet, WalletLink, WalletList, WalletSend } from "./endpoints/wallet";
import {
	DefiAddLiquidity,
	DefiBorrow,
	DefiOverview,
	DefiRemoveLiquidity,
	DefiRepay,
	DefiSwap,
	DefiVaultDeposit,
	DefiVaultWithdraw,
} from "./endpoints/defi";
import {
	GrowthCampaign,
	GrowthDraft,
	GrowthLead,
	GrowthLeads,
	GrowthOverview,
	GrowthPostStatus,
	GrowthPosts,
	GrowthScout,
} from "./endpoints/growth";
import {
	ConnectorConnect,
	ConnectorsList,
	DealAdvance,
	DealCreate,
	DealsList,
	GrowthAnalytics,
	PostPublish,
} from "./endpoints/growthx";
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

// Training — Lumi & Aether study the Invest trading curriculum
openapi.post("/lumi/train", LumiTrain);
openapi.get("/lumi/curriculum", LumiCurriculum);

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

// Aether token — the AI-credit ledger (Sui-style tokenomics)
openapi.get("/aether", AetherOverview);
openapi.get("/aether/ledger", AetherLedger);
openapi.get("/aether/chain", AetherChain);
openapi.post("/aether/transfer", AetherTransfer);
openapi.post("/aether/reward", AetherReward);
openapi.post("/aether/spend", AetherSpend);
openapi.post("/aether/audit", AetherAudit);

// Wallet — an in-app web3 wallet over the AETHER ledger
openapi.get("/wallet", WalletList);
openapi.post("/wallet/aether", AetherWallet);
openapi.post("/wallet", WalletCreate);
openapi.get("/wallet/:ref", WalletGet);
openapi.post("/wallet/send", WalletSend);
openapi.post("/wallet/link", WalletLink);

// DeFi — AETHER liquidity pool, vaults, lending (under the Aether realm)
openapi.get("/defi", DefiOverview);
openapi.post("/defi/pool/add", DefiAddLiquidity);
openapi.post("/defi/pool/remove", DefiRemoveLiquidity);
openapi.post("/defi/swap", DefiSwap);
openapi.post("/defi/vault/deposit", DefiVaultDeposit);
openapi.post("/defi/vault/withdraw", DefiVaultWithdraw);
openapi.post("/defi/borrow", DefiBorrow);
openapi.post("/defi/repay", DefiRepay);

// Shield — web3 security, red-team, decentralization, privacy-first KYC
openapi.get("/shield", ShieldStatus);
openapi.post("/shield/scan", ShieldScan);
openapi.post("/shield/kyc", ShieldKyc);

// Growth — PR, content drafting, campaigns, and lead-gen
openapi.get("/growth", GrowthOverview);
openapi.post("/growth/post", GrowthDraft);
openapi.patch("/growth/post/:id", GrowthPostStatus);
openapi.get("/growth/posts", GrowthPosts);
openapi.post("/growth/campaign", GrowthCampaign);
openapi.post("/growth/lead", GrowthLead);
openapi.get("/growth/leads", GrowthLeads);
openapi.post("/growth/scout", GrowthScout);
// Growth v2 — connectors (real publishing), deals pipeline, analytics
openapi.get("/growth/connectors", ConnectorsList);
openapi.post("/growth/connect", ConnectorConnect);
openapi.post("/growth/post/:id/publish", PostPublish);
openapi.get("/growth/deals", DealsList);
openapi.post("/growth/deal", DealCreate);
openapi.patch("/growth/deal/:id", DealAdvance);
openapi.get("/growth/analytics", GrowthAnalytics);

// Analytics (feeds the cockpit)
openapi.get("/analytics/overview", AnalyticsOverview);

// Scheduled autonomy: on a Cron Trigger firing, Lumi pulses herself —
// trades, learns, audits, sweeps, pursues her initiative — unattended.
import { lumiPulse } from "./engine/lumi";

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		// Miner off on the unattended cron: Lumi audits, sweeps and keeps house
		// every hour but opens no new trades while no one is watching. Trading
		// happens only on an explicit manual pulse / engine run.
		ctx.waitUntil(lumiPulse(env.DB, { trade: false }));
	},
};
