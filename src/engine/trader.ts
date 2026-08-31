// Reg's trading cycle: advance the market, let every active bot signal and
// trade, compound balances, and have the Reporter file a cycle report.

import { getCursor, saveCursor } from "./market";
import { buildSlice } from "./feed";
import { evaluateRisk, isHalted } from "./risk";
import { signalFor, Signal, StrategyParams } from "./strategies";

interface BotRow {
	id: number;
	name: string;
	soul: string;
	strategy_id: number;
	symbol: string;
	balance: number;
	starting_balance: number;
	status: string;
	kind: string;
	params: string;
}

interface OpenTrade {
	id: number;
	side: string;
	qty: number;
	entry_price: number;
}

export interface CycleResult {
	ticks: number;
	fromTick: number;
	toTick: number;
	botsTraded: number;
	opened: number;
	closed: number;
	wins: number;
	losses: number;
	totalPnl: number;
	colonyEquity: number;
	paused: number;
	halted: boolean;
	live: boolean;
}

const MAX_TICKS_PER_CYCLE = 2000;
// Drawdown kill-switch: an active bot that falls below this fraction of its
// starting balance is paused before it can bleed further.
const CAPITAL_FLOOR = 0.4;

const clampUnit = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

export async function runCycle(db: D1Database, ticks: number): Promise<CycleResult> {
	const steps = Math.min(Math.max(1, Math.floor(ticks)), MAX_TICKS_PER_CYCLE);

	const bots = (
		await db
			.prepare(
				`SELECT b.id, b.name, b.soul, b.strategy_id, b.symbol, b.balance, b.starting_balance, b.status, s.kind, s.params
				 FROM bots b JOIN strategies s ON s.id = b.strategy_id
				 WHERE b.status = 'active' AND s.status = 'active'`,
			)
			.all<BotRow>()
	).results;

	const result: CycleResult = {
		ticks: steps,
		fromTick: 0,
		toTick: 0,
		botsTraded: bots.length,
		opened: 0,
		closed: 0,
		wins: 0,
		losses: 0,
		totalPnl: 0,
		colonyEquity: 0,
		paused: 0,
		halted: false,
		live: false,
	};

	// Risk gate: when the colony is halted, bots still MANAGE (close) open
	// positions but open no new ones — capital stops going out.
	const halted = await isHalted(db);
	result.halted = halted;

	// One shared market per symbol; all bots on a symbol see the same tape.
	const symbols = [...new Set(bots.map((b) => b.symbol))];
	const statements: D1PreparedStatement[] = [];

	for (const symbol of symbols) {
		const cursor = await getCursor(db, symbol);
		// The feed adapter decides the tape: deterministic sim, or a replay of
		// real observations banked from a live source (same interface).
		const slice = await buildSlice(db, cursor, steps);
		const toTick = slice.toTick;
		const prices = slice.prices;
		if (slice.live) result.live = true;
		result.fromTick = cursor.tick;
		result.toTick = toTick;

		for (const bot of bots.filter((b) => b.symbol === symbol)) {
			const soul = safeJson(bot.soul);
			const params = safeJson(bot.params) as StrategyParams;
			const riskFraction = 0.05 + 0.25 * Number(soul.risk ?? 0.3);
			// Profit-taking: bank a winner once it's up by take-profit, cut a loser
			// at a tighter stop — so a position no longer rides all the way back into
			// the red waiting for the signal to flip. Both are favourable/adverse
			// price-move fractions off the entry, shaped by the bot's DNA. Stop is
			// always well inside take-profit, giving every trade positive asymmetry.
			const patience = clampUnit(Number(soul.patience ?? 0.6));
			const riskAppetite = clampUnit(Number(soul.risk ?? 0.3));
			const takeProfit = 0.03 + 0.04 * patience; // 3%–7% up → lock it in
			const stopLoss = 0.015 + 0.02 * riskAppetite; // 1.5%–2.3% down → cut it

			let open =
				(await db
					.prepare(
						"SELECT id, side, qty, entry_price FROM trades WHERE bot_id = ? AND outcome = 'open' ORDER BY id DESC LIMIT 1",
					)
					.bind(bot.id)
					.first<OpenTrade>()) ?? null;
			let position: Signal = open ? (open.side === "long" ? 1 : -1) : 0;
			let balance = bot.balance;

			for (let t = cursor.tick + 1; t <= toTick; t++) {
				const price = prices[t];
				const { signal, reason } = signalFor(bot.kind, params, prices.slice(0, t + 1));
				let blockReopen = false;

				// Manage an open position EVERY tick: take-profit / stop-loss lock the
				// outcome the moment it crosses a threshold; a signal flip still exits
				// too. (The old code only looked at a position when the signal changed —
				// so winners gave their gains back and losers bled until a reversal.)
				if (open) {
					const move =
						open.side === "long"
							? (price - open.entry_price) / open.entry_price
							: (open.entry_price - price) / open.entry_price;
					let exitNote: string | null = null;
					if (move >= takeProfit) {
						exitNote = `take-profit +${(move * 100).toFixed(1)}%`;
						blockReopen = true;
					} else if (move <= -stopLoss) {
						exitNote = `stop-loss ${(move * 100).toFixed(1)}%`;
						blockReopen = true;
					} else if (signal !== position) {
						exitNote = reason;
					}

					if (!exitNote) continue; // holding — signal unchanged, neither threshold hit

					const pnl =
						open.side === "long"
							? (price - open.entry_price) * open.qty
							: (open.entry_price - price) * open.qty;
					balance += pnl;
					const outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : "flat";
					statements.push(
						db
							.prepare(
								"UPDATE trades SET exit_price = ?, pnl = ?, outcome = ?, closed_at_tick = ?, reason = reason || ' -> ' || ? WHERE id = ?",
							)
							.bind(price, pnl, outcome, t, exitNote, open.id),
					);
					result.closed++;
					result.totalPnl += pnl;
					if (outcome === "win") result.wins++;
					if (outcome === "loss") result.losses++;
					open = null;
					position = 0;
				}

				// Open a fresh position when flat and the signal points somewhere. After a
				// take-profit/stop-loss exit we wait a tick before re-entering.
				if (!open && !blockReopen && signal !== 0 && balance > 0 && !halted) {
					// Compounding: size scales with current balance, shaped by DNA.
					const qty = (balance * riskFraction) / price;
					const insert = await db
						.prepare(
							"INSERT INTO trades (bot_id, strategy_id, symbol, side, qty, entry_price, opened_at_tick, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
						)
						.bind(bot.id, bot.strategy_id, symbol, signal === 1 ? "long" : "short", qty, price, t, reason)
						.first<{ id: number }>();
					open = { id: insert!.id, side: signal === 1 ? "long" : "short", qty, entry_price: price };
					position = signal;
					result.opened++;
				}
			}

			// Drawdown kill-switch: pause the bot and file an alert if it drew
			// down below the capital floor this cycle.
			if (balance < CAPITAL_FLOOR * bot.starting_balance) {
				statements.push(
					db.prepare("UPDATE bots SET balance = ?, status = 'paused' WHERE id = ?").bind(balance, bot.id),
				);
				statements.push(
					db
						.prepare(
							"INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reg', 'alert', ?, ?, ?, 'invest')",
						)
						.bind(
							`Kill-switch: ${bot.name} paused`,
							`Bot "${bot.name}" drew down to ${balance.toFixed(2)} — below ${(CAPITAL_FLOOR * 100).toFixed(0)}% of its starting balance ${bot.starting_balance.toFixed(2)}. Trading paused.`,
							JSON.stringify({ botId: bot.id, balance, startingBalance: bot.starting_balance }),
						),
				);
				result.paused++;
			} else {
				statements.push(db.prepare("UPDATE bots SET balance = ? WHERE id = ?").bind(balance, bot.id));
			}
			result.colonyEquity += balance;
		}

		await saveCursor(db, { ...cursor, tick: toTick, price: prices[toTick] });
	}

	if (statements.length > 0) await db.batch(statements);

	// Risk gate: after balances settle, trip the halt if this cycle pushed the
	// colony past its drawdown or exposure limits.
	await evaluateRisk(db);

	// The Reporter files the cycle into the Databank.
	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('reporter', 'cycle', ?, ?, ?, 'invest')")
		.bind(
			`Cycle ${result.fromTick} → ${result.toTick}`,
			`${result.botsTraded} bots traded ${result.ticks} ticks: ${result.closed} closed (${result.wins}W/${result.losses}L), net ${result.totalPnl.toFixed(2)}. Colony equity ${result.colonyEquity.toFixed(2)}.`,
			JSON.stringify(result),
		)
		.run();

	return result;
}

function safeJson(raw: string): Record<string, unknown> {
	try {
		return JSON.parse(raw) ?? {};
	} catch {
		return {};
	}
}
