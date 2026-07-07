// Lumi's expeditions into the outside world: free, key-less public sources.
// Everything she finds is stored in the Databank's knowledge bank, so the
// colony's memory grows with every trip.

import { awardXp, recordMetric } from "./lumi";

export interface Finding {
	source: string;
	kind: string;
	title: string;
	url: string;
	detail: string;
}

export interface ResearchResult {
	query: string;
	found: Finding[];
	stored: number;
	errors: string[];
}

const FETCH_TIMEOUT_MS = 8000;

async function fetchJson(url: string): Promise<unknown> {
	const res = await fetch(url, {
		headers: { "User-Agent": "lumi-colony/1.0", Accept: "application/json" },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

// Search the Hugging Face Hub (models and datasets — free, no key) and bank
// every finding.
export async function research(db: D1Database, query: string): Promise<ResearchResult> {
	const found: Finding[] = [];
	const errors: string[] = [];

	for (const kind of ["models", "datasets"] as const) {
		try {
			const items = (await fetchJson(
				`https://huggingface.co/api/${kind}?search=${encodeURIComponent(query)}&limit=5&sort=downloads`,
			)) as { id: string; downloads?: number; likes?: number }[];
			for (const item of items) {
				found.push({
					source: "huggingface",
					kind: kind.slice(0, -1),
					title: item.id,
					url: `https://huggingface.co/${kind === "datasets" ? "datasets/" : ""}${item.id}`,
					detail: `${(item.downloads ?? 0).toLocaleString()} downloads, ${item.likes ?? 0} likes`,
				});
			}
		} catch (err) {
			errors.push(`huggingface ${kind}: ${String(err)}`);
		}
	}

	let stored = 0;
	for (const f of found) {
		// Skip exact repeats so re-running a query doesn't bloat the bank.
		const dupe = await db
			.prepare("SELECT id FROM knowledge WHERE source = ? AND title = ? LIMIT 1")
			.bind(f.source, f.title)
			.first();
		if (dupe) continue;
		await db
			.prepare("INSERT INTO knowledge (source, kind, title, url, detail, data) VALUES (?, ?, ?, ?, ?, ?)")
			.bind(f.source, f.kind, f.title, f.url, f.detail, JSON.stringify({ query }))
			.run();
		stored++;
	}

	if (found.length > 0) {
		await awardXp(db, "insight", Math.min(20, 2 * stored + 4), `Research expedition "${query}"`);
	}
	await db
		.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'research', ?, ?, ?, 'tech')")
		.bind(
			`Research: "${query}"`,
			found.length > 0
				? `Lumi found ${found.length} sources on Hugging Face (${stored} new banked).`
				: `Expedition came back empty${errors.length ? ` — ${errors.join("; ")}` : ""}.`,
			JSON.stringify({ query, found: found.length, stored, errors }),
		)
		.run();

	return { query, found, stored, errors };
}

export interface ScoutResult {
	prices: Record<string, number>;
	stored: boolean;
	error: string | null;
}

// Grab a live crypto snapshot from CoinGecko (free, no key): Lumi's first
// window onto the real market — the seed of the live-data adapter.
export async function scoutMarket(db: D1Database): Promise<ScoutResult> {
	try {
		const data = (await fetchJson(
			"https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
		)) as Record<string, { usd: number }>;
		const prices: Record<string, number> = {};
		for (const [coin, v] of Object.entries(data)) {
			prices[coin] = v.usd;
			await recordMetric(db, `live_${coin}_usd`, v.usd, { source: "coingecko" });
		}
		await db
			.prepare("INSERT INTO knowledge (source, kind, title, url, detail, data) VALUES ('coingecko', 'market-snapshot', ?, 'https://www.coingecko.com', ?, ?)")
			.bind(
				`Live market ${new Date().toISOString().slice(0, 16)}`,
				Object.entries(prices)
					.map(([c, p]) => `${c} $${p.toLocaleString()}`)
					.join(", "),
				JSON.stringify(prices),
			)
			.run();
		await awardXp(db, "engineering", 10, "Live market scout");
		await db
			.prepare("INSERT INTO reports (author, kind, title, body, data, realm) VALUES ('lumi', 'scout', 'Live market snapshot', ?, ?, 'tech')")
			.bind(
				Object.entries(prices)
					.map(([c, p]) => `${c} at $${p.toLocaleString()}`)
					.join(", ") + " — real-world eyes open.",
				JSON.stringify(prices),
			)
			.run();
		return { prices, stored: true, error: null };
	} catch (err) {
		return { prices: {}, stored: false, error: String(err) };
	}
}
