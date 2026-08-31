// Deterministic simulated market. Given the same seed, the full price series
// is reproducible from tick 0, so no candle storage is needed — only the
// (symbol, seed, tick) cursor lives in the Databank.

export interface MarketCursor {
	symbol: string;
	tick: number;
	price: number;
	seed: number;
}

export function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const BASE_PRICE = 100;

// Regenerate the price series from tick 0 up to (and including) `uptoTick`.
// Random walk with drift regimes so trends exist for strategies to catch.
export function priceSeries(seed: number, uptoTick: number): number[] {
	const rand = mulberry32(seed);
	const prices: number[] = [BASE_PRICE];
	let drift = 0;
	for (let t = 1; t <= uptoTick; t++) {
		// Occasionally flip into a new drift regime (trend up, down, or chop).
		if (rand() < 0.02) {
			drift = (rand() - 0.5) * 0.004;
		}
		const shock = (rand() - 0.5) * 0.02;
		const prev = prices[t - 1];
		prices.push(Math.max(1, prev * (1 + drift + shock)));
	}
	return prices;
}

export async function getCursor(db: D1Database, symbol: string): Promise<MarketCursor> {
	const row = await db
		.prepare("SELECT symbol, tick, price, seed FROM market_state WHERE symbol = ?")
		.bind(symbol)
		.first<MarketCursor>();
	if (row) return row;
	// Derive a stable seed from the symbol so every environment agrees.
	let seed = 0;
	for (const ch of symbol) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
	const cursor = { symbol, tick: 0, price: BASE_PRICE, seed };
	await db
		.prepare("INSERT INTO market_state (symbol, tick, price, seed) VALUES (?, ?, ?, ?)")
		.bind(symbol, cursor.tick, cursor.price, cursor.seed)
		.run();
	return cursor;
}

export async function saveCursor(db: D1Database, cursor: MarketCursor): Promise<void> {
	await db
		.prepare("UPDATE market_state SET tick = ?, price = ? WHERE symbol = ?")
		.bind(cursor.tick, cursor.price, cursor.symbol)
		.run();
}
