// WHAT EVERY WRITING ROUTE IS ALLOWED TO DO WITHOUT A KEY.
//
// Two consecutive security holes in this codebase had the same shape: a
// boundary enforced at one layer and left open at the layer beneath. First the
// authority ledger, whose write endpoint had no lock. Then the scope model,
// which anyone could step around by calling /aether/transfer instead of asking
// Lumi to pay. Both were found by hand, by reading the route table. That does
// not scale, and it does not survive the next endpoint somebody adds.
//
// So the rule stops living in my head. Every mutating route is classified here,
// with the reason, and two mechanisms hold the classification honest:
//
//   1. A test reads src/index.ts and fails if any POST/PATCH/PUT/DELETE route
//      is missing from this table. You cannot add a writing endpoint without
//      deciding — in writing — what may reach it.
//   2. A live probe (probeGuards) calls every `creator` route with no key and
//      demands a refusal. A classification that says "guarded" while the
//      handler forgot the guard is exactly the bug we keep hitting, and this
//      is what catches it.
//
// Adding a route that moves value or speaks outward and marking it `open` is
// still possible — but it is now a deliberate line in this file, reviewable as
// such, rather than an omission nobody notices.

export type Protection =
	| "open" // no credential: reads, engine work, drafts. Cannot move value or speak outward.
	| "creator" // CREATOR_KEY: moves value, publishes outward, or changes what Lumi may do.
	| "bridge"; // its own shared secret (RP_SHARED_SECRET / LOCAL_AGENT_SECRET).

export interface RoutePolicy {
	route: string; // "METHOD /path" exactly as registered
	protection: Protection;
	why: string;
}

export const ROUTE_POLICY: RoutePolicy[] = [
	// --- Value movement. The spend scope means nothing if these are open. ---
	{ route: "POST /aether/transfer", protection: "creator", why: "moves AETHER between accounts" },
	{ route: "POST /aether/reward", protection: "creator", why: "moves AETHER out of the treasury" },
	{ route: "POST /aether/spend", protection: "creator", why: "moves AETHER back to the treasury" },
	{ route: "POST /wallet/send", protection: "creator", why: "moves AETHER between wallets" },
	{ route: "POST /defi/pool/add", protection: "creator", why: "moves AETHER into the pool" },
	{ route: "POST /defi/pool/remove", protection: "creator", why: "moves AETHER out of the pool" },
	{ route: "POST /defi/swap", protection: "creator", why: "moves AETHER across the AMM" },
	{ route: "POST /defi/vault/deposit", protection: "creator", why: "moves AETHER into a vault" },
	{ route: "POST /defi/vault/withdraw", protection: "creator", why: "moves AETHER out of a vault" },
	{ route: "POST /defi/borrow", protection: "creator", why: "locks collateral and issues a loan" },
	{ route: "POST /defi/repay", protection: "creator", why: "moves AETHER to settle a loan" },

	// --- Speaking outward, and changing who may do what. ---
	{ route: "POST /growth/connect", protection: "creator", why: "stores a live platform token" },
	{ route: "POST /growth/post/:id/publish", protection: "creator", why: "publishes content outside the system" },
	{ route: "POST /command", protection: "open", why: "routes any order, but guarded scopes need the key inside command()" },
	{ route: "PATCH /command/authority", protection: "open", why: "revoking needs nothing; granting a guarded scope needs the key inside setAuthority()" },
	{ route: "POST /bridges/trust", protection: "creator", why: "vouching for a caller silences the alert about that caller" },

	// --- Their own shared secret. A game server should not hold the creator key. ---
	{ route: "POST /rp/grant", protection: "bridge", why: "RP_SHARED_SECRET; treasury→player, supply-conserved" },
	{ route: "POST /rp/spend", protection: "bridge", why: "RP_SHARED_SECRET; player→treasury" },
	{ route: "POST /local/next", protection: "bridge", why: "LOCAL_AGENT_SECRET; the agent claims work" },
	{ route: "POST /local/result", protection: "bridge", why: "LOCAL_AGENT_SECRET; the agent reports an outcome" },

	// --- Open: engine work and record-keeping. None of it moves value or
	//     leaves the system, and locking it would make a fresh install look
	//     broken before the creator has set anything up. ---
	{ route: "POST /colony/seed", protection: "open", why: "seeds the starter colony; idempotent, no value" },
	{ route: "POST /bots", protection: "open", why: "creates a paper-trading bot" },
	{ route: "PATCH /bots/:id", protection: "open", why: "pauses/resumes a paper bot" },
	{ route: "POST /engine/run", protection: "open", why: "runs simulated trading" },
	{ route: "POST /engine/learn", protection: "open", why: "scores strategies from recorded evidence" },
	{ route: "POST /goals", protection: "open", why: "record-keeping" },
	{ route: "PATCH /goals/:id", protection: "open", why: "record-keeping" },
	{ route: "POST /lumi/pulse", protection: "open", why: "the heartbeat; each act inside is separately gated" },
	{ route: "POST /lumi/research", protection: "open", why: "reads public sources into knowledge" },
	{ route: "POST /lumi/scout", protection: "open", why: "reads public market data" },
	{ route: "POST /lumi/train", protection: "open", why: "studies a curriculum lesson" },
	{ route: "POST /auras", protection: "open", why: "creates a consent-gated profile" },
	{ route: "POST /realms/invest/audit", protection: "open", why: "read-only audit that records its result" },
	{ route: "POST /realms/guardian/sweep", protection: "open", why: "read-only sweep that records its result" },
	{ route: "POST /realms/wellness/checkin", protection: "open", why: "the creator's own check-in" },
	{ route: "POST /risk/halt", protection: "open", why: "STOPS trading — a safety action must never need a credential" },
	{ route: "POST /risk/resume", protection: "open", why: "resumes simulated trading only" },
	{ route: "PATCH /risk/config", protection: "open", why: "tightens/loosens paper-trading limits" },
	{ route: "POST /market/feed", protection: "open", why: "banks observed price ticks" },
	{ route: "POST /aether/audit", protection: "open", why: "read-only supply audit" },
	{ route: "POST /wallet", protection: "open", why: "opens a zero-balance wallet; supply-neutral" },
	{ route: "POST /wallet/aether", protection: "open", why: "mints Aether's own wallet once; supply-neutral" },
	{ route: "POST /wallet/link", protection: "open", why: "records a Sui address alongside an owner; moves nothing" },
	{ route: "POST /shield/scan", protection: "open", why: "read-only security scan that records findings" },
	{ route: "POST /shield/kyc", protection: "open", why: "stores a hash, never an identity" },
	{ route: "POST /integrity/scan", protection: "open", why: "read-only structural audit that records its result" },
	{ route: "POST /integrity/probe", protection: "open", why: "attacks this Worker's own locked routes with empty bodies; proves guards, changes nothing" },
	{ route: "POST /growth/post", protection: "open", why: "drafts stay local until published" },
	{ route: "PATCH /growth/post/:id", protection: "open", why: "moves a draft through local states only" },
	{ route: "POST /growth/campaign", protection: "open", why: "record-keeping" },
	{ route: "POST /growth/lead", protection: "open", why: "record-keeping" },
	{ route: "POST /growth/scout", protection: "open", why: "reads public sources for opportunities" },
	{ route: "POST /growth/newsroom", protection: "open", why: "drafts posts from recorded events; drafts never leave the system" },
	{ route: "POST /growth/deal", protection: "open", why: "record-keeping" },
	{ route: "PATCH /growth/deal/:id", protection: "open", why: "record-keeping" },
	{ route: "POST /orchestrator/dispatch", protection: "open", why: "runs an agent's real engine action; each is otherwise open" },
	{ route: "POST /orchestrator/council", protection: "open", why: "asks linked models a question" },
];

export function policyFor(route: string): RoutePolicy | undefined {
	return ROUTE_POLICY.find((p) => p.route === route);
}

export const CREATOR_ROUTES = ROUTE_POLICY.filter((p) => p.protection === "creator");
