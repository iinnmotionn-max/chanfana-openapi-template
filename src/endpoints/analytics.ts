// Everything Lumi's dashboard needs, in one call.

import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";
import { decorateBot } from "./bots";
import { realmsOverview, wellnessStats } from "./realms";
import { perfSummary, selfAssess } from "../engine/lumi";
import { getRisk } from "../engine/risk";
import { curriculumStatus } from "../engine/training";
import { tokenOverview } from "../engine/token";
import { suiChainStatus } from "../engine/sui";
import { shieldOverview } from "../engine/shield";
import { walletList } from "../engine/wallet";
import { defiOverview } from "../engine/defi";
import { growthOverview } from "../engine/growth";
import { connectorStatus, dealsPipeline } from "../engine/growthx";
import { orchestratorOverview } from "../engine/orchestrator";
import { commandOverview } from "../engine/command";

const MAX_CURVE_POINTS = 150;

export class AnalyticsOverview extends OpenAPIRoute {
	public schema = {
		tags: ["Analytics"],
		summary: "Colony overview: equity, bots, strategies, curve, feed, goals",
		responses: {
			"200": {
				description: "Dashboard payload",
				...contentJson({ success: z.boolean(), result: z.any() }),
			},
		},
	};

	public async handle(c: AppContext) {
		const db = c.env.DB;

		const [agents, bots, closedTrades, openTrades, reports, goals, market, strategies, realms, checks, wellness, lumi, quests, perf, risk, markets, training, aether, shield, wallets, defi, growth, deals, connectors] = await Promise.all([
			db.prepare("SELECT id, name, role, dna, status FROM agents ORDER BY id").all(),
			db
				.prepare(
					`SELECT b.id, b.name, b.soul, b.strategy_id, s.name as strategy, b.symbol,
					        b.balance, b.starting_balance, b.status,
					        COUNT(t.id) as closed,
					        SUM(CASE WHEN t.outcome = 'win' THEN 1 ELSE 0 END) as wins,
					        SUM(CASE WHEN t.outcome = 'loss' THEN 1 ELSE 0 END) as losses
					 FROM bots b
					 JOIN strategies s ON s.id = b.strategy_id
					 LEFT JOIN trades t ON t.bot_id = b.id AND t.outcome != 'open'
					 GROUP BY b.id ORDER BY b.balance DESC`,
				)
				.all(),
			db
				.prepare("SELECT closed_at_tick, pnl, outcome FROM trades WHERE outcome != 'open' ORDER BY closed_at_tick, id")
				.all<{ closed_at_tick: number; pnl: number; outcome: string }>(),
			db.prepare("SELECT COUNT(*) as n FROM trades WHERE outcome = 'open'").first<{ n: number }>(),
			db.prepare("SELECT * FROM reports ORDER BY id DESC LIMIT 12").all(),
			db.prepare("SELECT * FROM goals ORDER BY status = 'done', priority, id").all(),
			db.prepare("SELECT tick FROM market_state ORDER BY tick DESC LIMIT 1").first<{ tick: number }>(),
			db
				.prepare(
					`SELECT s.id, s.name, s.kind, s.generation, s.parent_id, s.status,
					        COUNT(t.id) as closed,
					        SUM(CASE WHEN t.outcome = 'win' THEN 1 ELSE 0 END) as wins,
					        COALESCE(SUM(t.pnl), 0) as totalPnl
					 FROM strategies s
					 LEFT JOIN trades t ON t.strategy_id = s.id AND t.outcome != 'open'
					 GROUP BY s.id ORDER BY s.status = 'active' DESC, totalPnl DESC`,
				)
				.all(),
			realmsOverview(db),
			db.prepare("SELECT * FROM checks ORDER BY id DESC LIMIT 10").all(),
			wellnessStats(db),
			selfAssess(db),
			db.prepare("SELECT * FROM quests ORDER BY status = 'done', id").all(),
			perfSummary(db),
			getRisk(db),
			db.prepare("SELECT symbol, tick, price, feed FROM market_state ORDER BY symbol").all(),
			curriculumStatus(db),
			tokenOverview(db),
			shieldOverview(db, c.env),
			walletList(db),
			defiOverview(db),
			growthOverview(db),
			dealsPipeline(db),
			connectorStatus(db, c.env),
		]);

		// InMotion RP — the Roblox city economy over the same conserved ledger.
		// Grants are treasury→rp rewards with memo 'rp:*'; spends flow back.
		const [rpCitizens, rpEarned, rpSpent, rpLedger] = await Promise.all([
			db
				.prepare("SELECT COUNT(*) as n, COALESCE(SUM(balance), 0) as bal FROM aether_accounts WHERE kind = 'rp'")
				.first<{ n: number; bal: number }>(),
			db
				.prepare("SELECT COALESCE(SUM(amount), 0) as v FROM aether_ledger WHERE to_owner LIKE 'rp-%' AND memo LIKE 'rp:%'")
				.first<{ v: number }>(),
			db
				.prepare("SELECT COALESCE(SUM(amount), 0) as v FROM aether_ledger WHERE from_owner LIKE 'rp-%' AND memo LIKE 'rp:%'")
				.first<{ v: number }>(),
			db
				.prepare(
					"SELECT from_owner, to_owner, amount, memo, created_at FROM aether_ledger WHERE memo LIKE 'rp:%' ORDER BY id DESC LIMIT 8",
				)
				.all(),
		]);
		const orchestrator = await orchestratorOverview(db, c.env);
		const command = await commandOverview(db);
		const rp = {
			citizens: rpCitizens?.n ?? 0,
			cityBalance: Number((rpCitizens?.bal ?? 0).toFixed(2)),
			earned: Number((rpEarned?.v ?? 0).toFixed(2)),
			spent: Number((rpSpent?.v ?? 0).toFixed(2)),
			ledger: rpLedger.results,
		};

		const botRows = bots.results.map(decorateBot);
		const closedRows = closedTrades.results;

		const startingEquity = botRows.reduce((n, b) => n + Number(b.starting_balance), 0);
		const equity = botRows.reduce((n, b) => n + Number(b.balance), 0);
		const wins = closedRows.filter((t) => t.outcome === "win").length;

		// Equity curve: cumulative PnL over closed trades, downsampled for the chart.
		let running = startingEquity;
		const fullCurve = closedRows.map((t) => {
			running += Number(t.pnl ?? 0);
			return { tick: t.closed_at_tick, equity: Number(running.toFixed(2)) };
		});
		const stride = Math.max(1, Math.ceil(fullCurve.length / MAX_CURVE_POINTS));
		const equityCurve = fullCurve.filter((_, i) => i % stride === 0 || i === fullCurve.length - 1);

		return {
			success: true,
			result: {
				colony: {
					equity: Number(equity.toFixed(2)),
					startingEquity,
					pnl: Number((equity - startingEquity).toFixed(2)),
					winRate: closedRows.length > 0 ? wins / closedRows.length : 0,
					closedTrades: closedRows.length,
					openTrades: openTrades?.n ?? 0,
					tick: market?.tick ?? 0,
				},
				agents: agents.results.map((a) => ({ ...a, dna: JSON.parse(String(a.dna)) })),
				bots: botRows,
				strategies: strategies.results.map((s) => ({
					...s,
					winRate: Number(s.closed) > 0 ? Number(s.wins) / Number(s.closed) : 0,
				})),
				equityCurve: [{ tick: 0, equity: startingEquity }, ...equityCurve],
				reports: reports.results.map((r) => ({ ...r, data: JSON.parse(String(r.data)) })),
				goals: goals.results,
				realms,
				checks: checks.results,
				wellness,
				lumi: { ...lumi.lumi, awareness: lumi.awareness },
				quests: quests.results,
				perf,
				risk,
				markets: markets.results,
				training,
				aether: { ...aether, chainLink: suiChainStatus(c.env) },
				shield,
				wallets,
				defi,
				growth: { ...growth, deals, connectors },
				rp,
				orchestrator,
				command,
			},
		};
	}
}
