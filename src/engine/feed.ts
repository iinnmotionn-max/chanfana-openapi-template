// Live data adapter behind the same interface as the deterministic sim market.
// A PriceFeed abstraction with two modes: sim (deterministic, byte-identical to
// the old behaviour) and live (replay banked real-world observations). Which
// mode a symbol uses lives in market_state.feed.

import { priceSeries } from "./market";

export interface FeedSlice {
	prices: number[];
	toTick: number;
	live: boolean;
	note: string | null;
}

export type FeedMode = "sim" | "live";

export async function feedMode(db: D1Database, symbol: string): Promise<FeedMode> {
	const row = await db
		.prepare("SELECT feed FROM market_state WHERE symbol = ?")
		.bind(symbol)
		.first<{ feed: string }>();
	return row && row.feed === "live" ? "live" : "sim";
}

export async function setFeedMode(db: D1Database, symbol: string, mode: FeedMode): Promise<void> {
	await db
		.prepare("UPDATE market_state SET feed = ? WHERE symbol = ?")
		.bind(mode, symbol)
		.run();
}

export async function buildSlice(
	db: D1Database,
	cursor: { symbol: string; tick: number; price: number; seed: number },
	steps: number,
): Promise<FeedSlice> {
	const toTick = cursor.tick + steps;
	const mode = await feedMode(db, cursor.symbol);

	// SIM path: byte-identical to the old deterministic behaviour.
	if (mode !== "live") {
		return { prices: priceSeries(cursor.seed, toTick), toTick, live: false, note: null };
	}

	// LIVE path: replay banked observations.
	const rows = await db
		.prepare("SELECT price FROM live_ticks WHERE symbol = ? ORDER BY id")
		.bind(cursor.symbol)
		.all<{ price: number }>();
	const L = (rows.results ?? []).map((r) => r.price);

	// Not enough real data: don't fabricate movement — a flat tape yields no
	// trend/signal, so bots hold rather than trade on fake data.
	if (L.length < 2) {
		const flat = L[0] ?? cursor.price ?? 100;
		const prices = new Array<number>(toTick + 1).fill(flat);
		return {
			prices,
			toTick,
			live: true,
			note: "insufficient live data (need >=2 observations)",
		};
	}

	// Stretch L across the index range 0..toTick with linear interpolation, so
	// the index math stays identical to the sim path.
	const prices: number[] = [];
	for (let i = 0; i <= toTick; i++) {
		const pos = toTick > 0 ? (i / toTick) * (L.length - 1) : 0;
		const lo = Math.floor(pos);
		const hi = Math.ceil(pos);
		prices.push(L[lo] + (L[hi] - L[lo]) * (pos - lo));
	}
	return { prices, toTick, live: true, note: null };
}
