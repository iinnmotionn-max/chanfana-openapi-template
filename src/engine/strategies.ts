// Parameterized strategy kinds. Each returns the desired position at the last
// tick of the given price series: 1 = long, -1 = short, 0 = flat.
// Params are plain JSON so the learning cycle can mutate them freely.

export type Signal = -1 | 0 | 1;

export interface StrategyRow {
	id: number;
	name: string;
	kind: string;
	params: string;
	generation: number;
	parent_id: number | null;
	status: string;
}

export interface StrategyParams {
	fast?: number;
	slow?: number;
	lookback?: number;
	threshold?: number;
	zEntry?: number;
	// Optional regime filter length. When >0, entries against the prevailing
	// trend (price on the wrong side of this SMA) are suppressed. Defaults OFF.
	trendLen?: number;
}

export const STRATEGY_KINDS = ["sma_cross", "momentum", "mean_reversion"] as const;

export const DEFAULT_PARAMS: Record<string, StrategyParams> = {
	sma_cross: { fast: 8, slow: 21 },
	momentum: { lookback: 12, threshold: 0.01 },
	mean_reversion: { lookback: 20, zEntry: 1.5 },
};

function sma(prices: number[], period: number, at: number): number {
	const start = Math.max(0, at - period + 1);
	let sum = 0;
	for (let i = start; i <= at; i++) sum += prices[i];
	return sum / (at - start + 1);
}

// Lumi's win-rate mechanism: an opt-in trend/regime filter. When `trendLen` is
// set, she refuses counter-trend entries — a long is blocked when price sits
// below the trend SMA, a short when price sits above it — so trades only fire in
// the direction of the prevailing regime. When `trendLen` is absent/0 the raw
// signal passes through untouched, preserving byte-identical legacy behaviour.
function applyTrendFilter(
	raw: { signal: Signal; reason: string },
	params: StrategyParams,
	prices: number[],
): { signal: Signal; reason: string } {
	const at = prices.length - 1;
	if (!params.trendLen || params.trendLen <= 0 || at < params.trendLen) return raw;
	const trend = sma(prices, params.trendLen, at);
	if (raw.signal === 1 && prices[at] < trend) return { signal: 0, reason: `${raw.reason} · blocked: below trend` };
	if (raw.signal === -1 && prices[at] > trend) return { signal: 0, reason: `${raw.reason} · blocked: above trend` };
	return raw;
}

export function signalFor(kind: string, params: StrategyParams, prices: number[]): { signal: Signal; reason: string } {
	const at = prices.length - 1;
	if (at < 2) return { signal: 0, reason: "warming up" };

	let raw: { signal: Signal; reason: string };
	switch (kind) {
		case "sma_cross": {
			const fast = params.fast ?? 8;
			const slow = params.slow ?? 21;
			if (at < slow) return { signal: 0, reason: "warming up" };
			const f = sma(prices, fast, at);
			const s = sma(prices, slow, at);
			if (f > s) raw = { signal: 1, reason: `sma${fast}>${slow}` };
			else if (f < s) raw = { signal: -1, reason: `sma${fast}<${slow}` };
			else raw = { signal: 0, reason: "sma flat" };
			break;
		}
		case "momentum": {
			const lookback = params.lookback ?? 12;
			const threshold = params.threshold ?? 0.01;
			if (at < lookback) return { signal: 0, reason: "warming up" };
			const ret = prices[at] / prices[at - lookback] - 1;
			if (ret > threshold) raw = { signal: 1, reason: `mom +${(ret * 100).toFixed(2)}%` };
			else if (ret < -threshold) raw = { signal: -1, reason: `mom ${(ret * 100).toFixed(2)}%` };
			else raw = { signal: 0, reason: "mom inside band" };
			break;
		}
		case "mean_reversion": {
			const lookback = params.lookback ?? 20;
			const zEntry = params.zEntry ?? 1.5;
			if (at < lookback) return { signal: 0, reason: "warming up" };
			const mean = sma(prices, lookback, at);
			let variance = 0;
			for (let i = at - lookback + 1; i <= at; i++) variance += (prices[i] - mean) ** 2;
			const std = Math.sqrt(variance / lookback) || 1e-9;
			const z = (prices[at] - mean) / std;
			if (z > zEntry) raw = { signal: -1, reason: `z=${z.toFixed(2)} rich` };
			else if (z < -zEntry) raw = { signal: 1, reason: `z=${z.toFixed(2)} cheap` };
			else raw = { signal: 0, reason: "z inside band" };
			break;
		}
		default:
			return { signal: 0, reason: `unknown kind ${kind}` };
	}

	return applyTrendFilter(raw, params, prices);
}

// Mutate a champion's params to create the next generation. `rand` is injected
// so evolution stays deterministic under test. `scale` widens the mutation
// spread — Lumi's Insight level raises it, letting her explore more boldly.
export function mutateParams(kind: string, params: StrategyParams, rand: () => number, scale = 1): StrategyParams {
	const jitter = (v: number, spread: number, min: number) => Math.max(min, v * (1 + (rand() - 0.5) * spread * scale));
	let child: StrategyParams;
	switch (kind) {
		case "sma_cross":
			child = {
				fast: Math.max(2, Math.round(jitter(params.fast ?? 8, 0.5, 2))),
				slow: Math.max(5, Math.round(jitter(params.slow ?? 21, 0.5, 5))),
			};
			break;
		case "momentum":
			child = {
				lookback: Math.max(3, Math.round(jitter(params.lookback ?? 12, 0.5, 3))),
				threshold: jitter(params.threshold ?? 0.01, 0.6, 0.001),
			};
			break;
		case "mean_reversion":
			child = {
				lookback: Math.max(5, Math.round(jitter(params.lookback ?? 20, 0.5, 5))),
				zEntry: jitter(params.zEntry ?? 1.5, 0.4, 0.5),
			};
			break;
		default:
			return { ...params };
	}

	// Let evolution discover Lumi's trend filter: half the time explore a fresh
	// trendLen in ~[10..60], otherwise carry forward the parent's setting (if any).
	if (rand() < 0.5) child.trendLen = Math.round(20 + rand() * 40);
	else if (params.trendLen) child.trendLen = params.trendLen;

	return child;
}
