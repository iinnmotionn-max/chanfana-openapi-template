# LUMI COLONY — System Blueprint

Lumi is a multi-realm creator AI built on Cloudflare Workers + D1. She watches
over **six realms** from one **Creator Cockpit** (`GET /dash`); the original
self-improving paper-trading colony lives on as the **Invest** realm — now
merged with **Aether** (it handles money and settles in AETHER, so trading,
token, wallet and DeFi are one realm; internal key stays `invest`).
The core intelligences working as one unit:

| Agent        | Role                                                                          | Where it lives                     |
| ------------ | ----------------------------------------------------------------------------- | ---------------------------------- |
| **Lumi**     | Front-end intellect. The Creator Cockpit: realms, visuals, goals, reports.    | `GET /dash` (`src/dash/`)           |
| **Reg**      | Back-end operator. Runs the engine, audits, sweeps — records everything.      | API endpoints (`src/endpoints/`)    |
| **Databank** | Memory. Every bot, strategy, trade, check, report, and goal — nothing lost.   | D1 database (`migrations/`)         |
| **Observer** | Watches every cycle, measures performance.                                    | `src/engine/learning.ts` (metrics)  |
| **Reporter** | Writes a report into the Databank after every cycle, audit, sweep, check-in.  | `reports` table + dash feed         |

## The realms

Every realm has a mission, a live status (`nominal` / `watch` / `alert`), its
own checks, and its own goals — all in the same Databank, all visible from
the cockpit and `GET /realms`.

| Realm        | Mission                                                                                   | Status is driven by            |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------ |
| **Invest / Aether** | Grow paper capital with flawless ledger integrity + active learning, and run the AI-credit economy: AETHER token ledger, in-app web3 wallet, DeFi (AMM pool / vaults / lending), and the InMotion RP bridge (Roblox city players earn conserved AETHER). It handles money. | `POST /realms/invest/audit` |
| **Guardian** | Protection, security, and privacy — "the man around the house". Sweeps the whole system.   | `POST /realms/guardian/sweep`  |
| **Tech**     | Dev/tech support diagnostics: table counts, ticks, active bots, every realm's health.      | `GET /realms/tech/status`      |
| **Wellness** | Creator check-ins: mood, energy, streaks. The colony works for a human.                    | `POST /realms/wellness/checkin` |
| **Shield**   | Web3 security — red-team scans, contract posture, decentralization scoring, privacy-first KYC (a hash, never an identity). | `POST /shield/scan` |
| **Growth**   | PR, content drafting, campaigns, lead-gen; connectors for real publishing + a deals pipeline. | `GET /growth`, `POST /growth/scout` |

- **Invest audit** runs five checks — `ledger-reconciliation` (every bot's
  starting balance + closed-trade PnL must equal its balance to the cent),
  `trade-validity`, `single-exposure`, `capital-floor`, `evidence-freshness` —
  records each in `checks`, files an `audit` report, and sets the realm status
  from the worst result.
- **Guardian sweep** runs `databank-online`, `invest-ledger`, `privacy-scan`
  (flags PII such as email addresses left in notes), `agents-heartbeat`
  (touches every active agent's `last_seen`), and `market-continuity`; it
  files a `sweep` report and updates the realm status.
- **Kill-switch.** After every trading cycle, any active bot whose balance
  falls below 40% of its starting balance is auto-paused; the cycle result
  reports `paused` and an `alert` report is filed in the Invest realm.

## Lumi's evolution — skills, quests, awareness, initiative

Lumi is a living system, not a static dashboard:

- **Skills** (`lumi_state`): Insight, Vigilance, Engineering, Empathy — XP
  from real work only (cycles, learning, audits, sweeps, check-ins, auras).
  Levels follow a square curve and **feed back into the engine**: Insight
  widens mutation spread and breeds bigger champion broods; Engineering
  raises ticks-per-pulse.
- **Quests** (`quests`): a seeded task line evaluated against real Databank
  state (trades closed, generations reached, clean sweeps, check-ins,
  knowledge gathered). Completion pays XP and is chronicled.
- **Awareness** (`selfAssess`): every pulse she states where she is — stage
  (Hatchling → Apprentice → Operator → Strategist → Sage), focus, current
  initiative (the open quest closest to done), and blockers.
- **Initiative** (`pursueInitiative`): she acts on the assessment — extra
  cycles, research expeditions, market scouts — and keeps a self-set goal in
  the Databank until the quest completes. She does not stop until it's done.
- **Automation**: cockpit Autopilot pulses her every 15s in the browser; a
  Cron Trigger pulses her hourly when deployed. Engine phase durations land
  in `metrics` (cycle/learn/audit/sweep/pulse ms) — the Tech realm's
  performance monitor.
- **Calm cockpit**: the dashboard is animation-heavy, so it self-throttles —
  when the browser tab is backgrounded (`visibilitychange`) every animation
  freezes (`html.calm`) and polling stops, costing the CPU nothing when
  unwatched. The live refresh is 8s. There is deliberately **no** background
  compute of any kind (no miner, no worker, no WASM) — just polling + SVG/CSS.
- **Knowledge** (`knowledge`): expeditions to free public sources (Hugging
  Face Hub, CoinGecko) are banked permanently and earn Insight.
- **Aura layer** (`auras`): personality + design profiles of clients, brands,
  users, investors → personalization briefs (tone, detail, pacing, palette,
  risk framing). Privacy is structural: notes require consent, the Guardian's
  privacy scan covers aura notes, `aura-consent` fails the sweep on
  violations, and the creator is never profiled.

## The Invest realm — the trading colony

### Why the bots were losing (and how this fixes it)

A low win percentage isn't fixed by tweaking one bot — it's fixed by a **system
that measures, learns, and reallocates**:

1. **Everything is recorded.** Every trade a bot takes lands in the Databank with
   entry, exit, PnL, outcome, and the reason (signal) it fired.
2. **The Observer scores strategies on evidence.** After trades accumulate, each
   strategy gets a score from its real trade history: win rate, expectancy,
   profit factor — not vibes.
3. **Losers are retired, winners compound.** The learning cycle retires
   strategies that score below the floor, reassigns their bots to the best
   performer, and **compounds balances** — position size scales with each bot's
   growing (or shrinking) equity, so wins compound and losers self-throttle.
4. **Winners evolve.** The top strategy is cloned with mutated parameters
   (a new generation, lineage tracked via `parent_id`). The colony explores
   around what already works instead of guessing randomly.
5. **Bots carry a soul.** Each bot inherits DNA (risk appetite, patience,
   discipline) merged from Lumi, Reg, and the Databank's agent registry. DNA
   shapes position sizing and behavior, so bots are individuals, not clones.

### Every trade takes profit and cuts losses

Scoring and evolution work across *many* trades; this rule protects *each* one.
A position used to close only when the strategy signal flipped — so winners
rode all the way back to flat and losers bled until a reversal. That was the
leak. Now every open position is managed **on every tick** (`src/engine/trader.ts`):

- **Take-profit** — bank the win once the position is up by 3–7% (the band is
  set by the bot's `patience` DNA: calmer souls let winners run further).
- **Stop-loss** — cut the loss once it's down 1.5–2.3% (set by `risk` DNA).
  The stop always sits *inside* the take-profit, so every trade carries
  positive asymmetry: losses are capped small, wins are allowed to be larger.
- **Signal reversal** still exits too, and flips into the opposite side.
- After a take-profit/stop-loss exit the bot waits one tick before re-entering,
  so it doesn't instantly re-open the trade it just closed.

Each close records *why* in the trade's `reason` (`take-profit +5.2%`,
`stop-loss -1.9%`, or the signal), so the ledger is self-explaining. This is a
low-win-rate / high-expectancy profile by design: many small capped losses
offset by fewer, larger wins. On the seeded tape the colony runs net-positive
rather than bleeding. Above this sits the 40%-of-starting-balance kill-switch as
the last line of defence.

### Safety stance

- **Paper trading only.** Deterministic simulated market (seeded random walk).
  No exchange keys, no real funds. The identical engine interface is where a
  live-data adapter plugs in later — after the win rate is proven here.
- Nothing here guarantees market profits; it guarantees the machinery to
  measure honestly, cut losers fast, and compound what works.

## Architecture (vital core → outward)

```
migrations/            Databank schema, one numbered file per feature (0001→0016):
                       colony (agents/strategies/bots/trades/reports/goals/
                       market_state) → realms/checks/wellness → lumi evolution
                       (skills/quests/metrics) → knowledge → auras → live feed →
                       risk gates → aether token+ledger → shield → defi →
                       wallet → growth → growthx → invest∪aether merge
src/engine/            The colony's brains:
  market.ts            Deterministic seeded price series (reproducible ticks)
  feed.ts              PriceFeed adapter: sim tape OR replay of banked live ticks
  strategies.ts        SMA-cross, momentum, mean-reversion + opt-in trend filter
  trader.ts            Runs a cycle: signals → execute → record; take-profit /
                       stop-loss manages each position every tick; compounds;
                       kill-switch pauses drained bots
  learning.ts          Observer metrics + retire/evolve/reassign + colony DNA
  lumi.ts              Skills/XP, quests, awareness, initiative, and lumiPulse
                       (the autonomous heartbeat: trade→learn→audit→sweep→quests)
  integrity.ts         Invest audit checks (ledger reconciliation + 4 more)
  guardian.ts          System sweep: databank/ledger/privacy/heartbeat/continuity
  risk.ts              Drawdown/exposure limits + global halt
  knowledge.ts         Expeditions to public sources (HF Hub, CoinGecko)
  training.ts          Trading curriculum Lumi & Aether study (Invest realm)
  aura.ts              Consent-gated personality/design profiles + briefs
  token.ts             AETHER: fixed-supply conserved credit ledger
  wallet.ts            In-app web3 wallet over the ledger (0x addresses, Sui link)
  defi.ts              AMM pool, yield vaults, collateralized lending
  sui.ts               Sui chain-link status (reads *_PACKAGE_ID / *_CAP secrets)
  shield.ts            Web3 security posture, red-team scan, privacy-first KYC
  growth.ts / growthx.ts  Content/campaigns/leads; connectors + deals pipeline
src/endpoints/         Reg's API — thin HTTP layer over the engine (see table)
src/dash/index.ts      Lumi: the self-contained Creator Cockpit — one 1.6k-line
                       HTML doc, inline SVG charts, /analytics/overview polling,
                       calm-mode throttling. No CDN, no build step.
sui/aether/            Move package for the on-chain AETHER coin (publish.sh)
scripts/               dev.sh (local) + golive.sh (Cloudflare deploy)
tests/integration/     11 suites, 83 tests: seed→trade→learn→evolve; audit→
                       sweep→check-in; aether, wallet, defi, shield, growth(x),
                       buildplan, freshness
```

## The flow (how the agents hand off to each other)

```
POST /colony/seed      Reg births the starter colony from agent DNA
POST /engine/run       Reg advances the market N ticks; every active bot
                       signals, trades, and compounds; the kill-switch
                       pauses any bot under the capital floor; Reporter
                       files a cycle report. Pass {learn:true} to run a
                       learning pass in the same call.
POST /engine/learn     Observer scores every strategy from trade history;
                       retires losers, evolves the champion, reassigns bots;
                       Reporter files a learning report
POST /lumi/pulse       One autonomous heartbeat: trade → learn → audit →
                       sweep → quests → awareness → initiative, all in one
                       call. The Cron Trigger fires this hourly when deployed.
POST /realms/invest/audit    Ledger + trade integrity checks; realm status set
POST /realms/guardian/sweep  Security/privacy sweep across the whole system
GET  /realms/tech/status     Diagnostics: table counts, tick, realm health
POST /realms/wellness/checkin  Creator logs mood/energy; Lumi tracks trend
POST /shield/scan      Red-team the posture; file findings + Shield status
GET  /aether · /wallet · /defi   The AI-credit economy: token supply, wallet
                       balances/sends, pool/vaults/lending — all conserved
GET  /growth · POST /growth/scout   Draft content, hunt leads, move deals
GET  /dash             Lumi reads the Databank through Reg's analytics and
                       renders the Creator Cockpit (calm-mode throttled)
```

Run cycles and learning passes repeatedly — by hand, by `POST /lumi/pulse`,
or unattended on the Cron Trigger — and the colony trains itself on its own
history, each generation built from the evidence of the last.

## API surface

Full list is auto-documented at `GET /` (OpenAPI). Grouped by realm/subsystem:

| Group | Endpoints | Purpose |
| ----- | --------- | ------- |
| **Colony** | `POST /colony/seed` · `GET /agents` · `GET /bots` `POST /bots` `PATCH /bots/:id` · `GET /strategies` · `GET /trades` | Seed the colony; agents/DNA; bots + control; strategies + lineage; trade history |
| **Engine** | `POST /engine/run` (`{ticks, learn?}`) · `POST /engine/learn` | Run a trading cycle (TP/SL per tick); score/retire/evolve |
| **Lumi** | `GET /lumi` · `POST /lumi/pulse` · `POST /lumi/research` · `POST /lumi/scout` · `GET /knowledge` · `POST /lumi/train` · `GET /lumi/curriculum` | Profile/skills; autonomous heartbeat; expeditions; curriculum |
| **Realms** | `GET /realms` · `POST /realms/invest/audit` · `POST /realms/guardian/sweep` · `GET /realms/tech/status` · `GET /realms/wellness` `POST /realms/wellness/checkin` | Six realms: mission, status, checks, goals |
| **Risk** | `GET /risk` · `POST /risk/halt` `POST /risk/resume` · `PATCH /risk/config` | Drawdown/exposure gates + global halt |
| **Market** | `GET /market` · `POST /market/feed` | Switch a symbol between sim tape and live replay |
| **Aether** | `GET /aether` `/aether/ledger` `/aether/chain` · `POST /aether/transfer` `/reward` `/spend` `/audit` | AETHER token ledger (conserved supply) |
| **Wallet** | `GET /wallet` `/wallet/:ref` · `POST /wallet` `/wallet/send` `/wallet/link` `/wallet/aether` | In-app web3 wallet; Aether self-mints its own |
| **DeFi** | `GET /defi` · `POST /defi/pool/{add,remove}` `/defi/swap` `/defi/vault/{deposit,withdraw}` `/defi/{borrow,repay}` | AMM pool, vaults, lending |
| **Shield** | `GET /shield` · `POST /shield/scan` `/shield/kyc` | Security posture, red-team, privacy-first KYC |
| **Growth** | `GET /growth` `/growth/posts` `/growth/leads` `/growth/deals` `/growth/connectors` `/growth/analytics` · `POST /growth/{post,campaign,lead,scout,connect,deal}` … | Content, campaigns, leads, connectors, deals |
| **InMotion RP** | `POST /rp/grant` · `GET /rp/player/:userId` | Roblox city bridge: credit players' AETHER (treasury→player, secret-gated via `RP_SHARED_SECRET`, off until set) |
| **Aura** | `GET /auras` `/auras/:id/brief` · `POST /auras` | Consent-gated profiles + personalization briefs |
| **Records / cockpit** | `GET /reports` · `GET /goals` `POST/PATCH` · `GET /analytics/overview` · `GET /dash` · `GET /` | Feed, goals, one-call cockpit payload, dashboard, OpenAPI |

## Roadmap (seeded as live goals in the Databank)

1. **Prove the loop** — colony seeds, trades, learns, evolves; tests green. ✅ this build
2. **Stop the bleed** — per-trade take-profit/stop-loss caps every loss and
   banks every win; the colony runs net-positive on the seeded tape. ✅
3. **Raise the win rate** — run many cycles, let selection pressure and the
   trend filter work; tune score floor, mutation ranges, and the TP/SL bands
   from evidence. (Note: the current TP/SL profile trades a *lower* win rate for
   *higher* expectancy — retune the bands if a higher win % is the goal.)
4. **Live data adapter** — ✅ shipped: `src/engine/feed.ts` replays banked real
   observations behind the same `PriceFeed` interface (still paper execution);
   flip a symbol with `POST /market/feed`.
5. **Scheduled autonomy** — ✅ shipped: the Cron Trigger fires `POST /lumi/pulse`
   hourly so the colony trades/learns/audits/sweeps unattended.
6. **Risk gates for real capital** — gates shipped (`src/engine/risk.ts`:
   drawdown/exposure limits + global halt); broker/exchange integration stays
   gated behind sustained, measured edge.

## Rules of the build

- **No dead code.** No orphaned endpoints, exports, types, files, or tables.
  Sweep for stale code regularly — see below.
- Every feature lands with an integration test in the same commit.
- Schema changes only via migrations; the Databank is the single source of truth.
  Remove stale schema forward-only (a `DROP ... IF EXISTS` migration), never by
  editing or deleting an already-applied migration.
- Determinism first: seeded market so every run is reproducible and debuggable.
- Vital core outward: schema → engine → API → visuals, in that order, always shippable.

### Stale-code sweep (how Lumi keeps herself clean)

Run this periodically — after big features, before a release, or on request:

1. **Drift** — `grep` for hard-coded counts/lists that fall out of date
   (e.g. "four realms", route tables, the API surface here) and reconcile them
   to the code. Docs are part of the build.
2. **Dead exports/types** — for every `export`, check it's referenced outside
   its own file (or at all). Unused `interface`/`type`/function → delete it.
   (This is how `StrategyRow` and `HandleArgs` were removed.)
3. **Orphan schema** — every table/column should have a reader and a writer in
   `src/`. Orphans (like the template's `tasks` table) get a forward `DROP`.
4. **Template scaffolding** — no leftover demo endpoints, `dummy`, hello-world,
   or copy that describes a system we no longer are.
5. **Honest seams stay.** A commented connector call guarded by a missing secret
   (e.g. `growthx.ts`) is a deliberate seam, not dead code — leave it.

Green bar is the gate: `npx tsc --noEmit` and `npm test` (83) must pass after
any sweep.
