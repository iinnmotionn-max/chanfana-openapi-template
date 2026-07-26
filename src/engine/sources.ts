// WHERE EVERY PANEL'S NUMBERS ACTUALLY COME FROM.
//
// Every panel in the cockpit renders real rows out of the Databank — none of
// it is placeholder or mock. But "real rows" and "real world" are different
// claims, and the screen was making them look the same. A bot's equity curve
// is a truthful record of trades that genuinely happened... against a
// deterministic simulated price tape. Both halves of that are true, and a
// number with no label lets you read only the flattering half.
//
// So each panel now states its own provenance, computed from live state rather
// than hardcoded:
//
//   live     real outside-world data is flowing right now
//   ledger   real recorded value inside this system, conserved and audited
//   measured real state of this running system (security, integrity, health)
//   sim      a deterministic simulation — honest, useful, and NOT the market
//   offline  needs a key or a secret; showing nothing rather than inventing it
//
// The rule this encodes: it is fine for a system to simulate, and fine for it
// to be unconfigured. It is not fine for either to be indistinguishable from
// the real thing.

export type SourceKind = "live" | "ledger" | "measured" | "sim" | "offline";

export interface PanelSource {
	panel: string;
	kind: SourceKind;
	label: string;
	detail: string;
}

function isSet(env: unknown, key: string): boolean {
	const v = (env as Record<string, unknown> | null | undefined)?.[key];
	return typeof v === "string" && v.length > 0;
}

export async function panelSources(db: D1Database, env: unknown): Promise<PanelSource[]> {
	// How much real market data has actually been banked, and is any symbol
	// replaying it? This is the one place where "live" is earned, not assumed.
	const [feeds, ticks] = await Promise.all([
		db.prepare("SELECT symbol, feed FROM market_state").all<{ symbol: string; feed: string }>(),
		db.prepare("SELECT COUNT(*) as n FROM live_ticks").first<{ n: number }>(),
	]);
	const liveSymbols = (feeds.results ?? []).filter((f) => f.feed === "live");
	const banked = ticks?.n ?? 0;
	// A symbol set to "live" with fewer than two observations replays a flat
	// line — the feed refuses to invent movement. That is not a live market and
	// must not be labelled as one.
	const marketIsLive = liveSymbols.length > 0 && banked >= 2;

	const out: PanelSource[] = [];
	const add = (panel: string, kind: SourceKind, label: string, detail: string) => out.push({ panel, kind, label, detail });

	add(
		"market",
		marketIsLive ? "live" : "sim",
		marketIsLive ? "LIVE" : "SIM TAPE",
		marketIsLive
			? `${liveSymbols.map((s) => s.symbol).join(", ")} replaying ${banked} banked real observations.`
			: `Deterministic simulated prices. ${banked} real observation(s) banked${banked > 0 ? " — switch a symbol to live in the RISK GATES panel" : "; scout the market to start banking them"}.`,
	);
	add(
		"trading",
		marketIsLive ? "live" : "sim",
		marketIsLive ? "PAPER · LIVE PRICES" : "PAPER · SIM PRICES",
		"Trades, balances and win rates are real recorded outcomes — of paper trading. No broker is connected and no real money moves, on either feed.",
	);
	add("aether", "ledger", "REAL LEDGER", "Fixed-supply AETHER, conserved on every move and audited each pulse. Real balances inside this system; not a traded asset outside it.");
	add("wallet", "ledger", "REAL LEDGER", "Real balances over the same conserved ledger. On-chain settlement only once AETHER_PACKAGE_ID is set.");
	add("defi", "ledger", "REAL LEDGER", "Pool, vaults and loans move real AETHER on the conserved ledger.");
	add("shield", "measured", "MEASURED", "Scored from this system's actual state — granted scopes, live guards, lockouts — never asserted.");
	add("integrity", "measured", "MEASURED", "Read from the running code and the live database, on every pulse.");
	add("guardian", "measured", "MEASURED", "Real checks against the live Databank.");
	add("lumi", "measured", "MEASURED", "XP and quests advance only from work actually recorded.");

	// Anything that reaches outside is offline until its credential exists —
	// and says which one, so "offline" is actionable rather than mysterious.
	const claude = isSet(env, "ANTHROPIC_API_KEY");
	const hf = isSet(env, "HF_TOKEN");
	add(
		"orchestrator",
		claude || hf ? "live" : "offline",
		claude || hf ? "LIVE MODELS" : "OFFLINE",
		claude || hf
			? `Linked: ${[claude ? "Claude" : null, hf ? "open models" : null].filter(Boolean).join(", ")}. Internal agents always run their real engine actions.`
			: "No model is linked — set ANTHROPIC_API_KEY or HF_TOKEN. Internal agents still run their real engine actions.",
	);
	const publishing = isSet(env, "X_TOKEN") || isSet(env, "LINKEDIN_TOKEN");
	add(
		"growth",
		publishing ? "live" : "offline",
		publishing ? "LIVE CONNECTOR" : "LOCAL DRAFTS",
		publishing ? "A connector is live; published posts leave the system." : "Nothing leaves the system. Posts stay local drafts until X_TOKEN or LINKEDIN_TOKEN is set.",
	);
	const rp = isSet(env, "RP_SHARED_SECRET");
	const rpCalls = rp ? ((await db.prepare("SELECT COUNT(*) as n FROM checks WHERE name = 'rp-bridge'").first<{ n: number }>())?.n ?? 0) : 0;
	add(
		"rp",
		rp && rpCalls > 0 ? "live" : "offline",
		rp && rpCalls > 0 ? "LIVE BRIDGE" : rp ? "ARMED" : "OFFLINE",
		rp && rpCalls > 0
			? `${rpCalls} real bridge call(s) from the Roblox city.`
			: rp
				? "Secret set, but no game server has called yet."
				: "Bridge off — set RP_SHARED_SECRET and drop the kit into Studio.",
	);
	const agent = isSet(env, "LOCAL_AGENT_SECRET");
	const claimed = agent ? ((await db.prepare("SELECT COUNT(*) as n FROM local_tasks WHERE status != 'queued'").first<{ n: number }>())?.n ?? 0) : 0;
	add(
		"machine",
		agent && claimed > 0 ? "live" : "offline",
		agent && claimed > 0 ? "LIVE AGENT" : agent ? "ARMED" : "OFFLINE",
		agent && claimed > 0 ? `${claimed} task(s) claimed by a real machine.` : agent ? "Secret set, but no agent has claimed a task yet." : "Set LOCAL_AGENT_SECRET and run agent/lumi-agent.mjs.",
	);

	return out;
}
