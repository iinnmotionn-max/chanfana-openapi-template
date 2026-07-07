# LUMI COLONY — System Blueprint

Lumi is a multi-realm creator AI built on Cloudflare Workers + D1. She watches
over four realms from one **Creator Cockpit** (`GET /dash`); the original
self-improving paper-trading colony lives on as the **Invest** realm.
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
| **Invest**   | Grow paper capital with flawless ledger integrity + active learning — it handles money.    | `POST /realms/invest/audit`    |
| **Guardian** | Protection, security, and privacy — "the man around the house". Sweeps the whole system.   | `POST /realms/guardian/sweep`  |
| **Tech**     | Dev/tech support diagnostics: table counts, ticks, active bots, every realm's health.      | `GET /realms/tech/status`      |
| **Wellness** | Creator check-ins: mood, energy, streaks. The colony works for a human.                    | `POST /realms/wellness/checkin` |

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

### Safety stance

- **Paper trading only.** Deterministic simulated market (seeded random walk).
  No exchange keys, no real funds. The identical engine interface is where a
  live-data adapter plugs in later — after the win rate is proven here.
- Nothing here guarantees market profits; it guarantees the machinery to
  measure honestly, cut losers fast, and compound what works.

## Architecture (vital core → outward)

```
migrations/            Databank schema (agents, strategies, bots, trades,
                       reports, goals, market_state, realms, checks,
                       wellness_checkins) + seed colony DNA + realm missions
src/engine/market.ts   Deterministic seeded price series (reproducible ticks)
src/engine/strategies.ts  SMA-cross, momentum, mean-reversion (parameterized)
src/engine/trader.ts   Runs a cycle: signals → executes → records trades,
                       compounds balances, kill-switch pauses drained bots,
                       Reporter writes cycle report
src/engine/learning.ts Observer metrics + retire/evolve/reassign + report
src/endpoints/         Reg's API: colony, bots, strategies, trades, reports,
                       goals, engine (run/learn), realms (audit, sweep,
                       status, wellness), analytics
src/dash/              Lumi: the self-contained Creator Cockpit (realms,
                       charts, feed, goals) — auto-refreshing visuals
tests/integration/     Full-loop + realm tests: seed → trade → learn →
                       evolve; audit → sweep → check-in
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
POST /realms/invest/audit    Ledger + trade integrity checks; realm status set
POST /realms/guardian/sweep  Security/privacy sweep across the whole system
GET  /realms/tech/status     Diagnostics: table counts, tick, realm health
POST /realms/wellness/checkin  Creator logs mood/energy; Lumi tracks trend
GET  /dash             Lumi reads the Databank through Reg's analytics and
                       renders the Creator Cockpit
```

Run cycles and learning passes repeatedly (cron, CI, or by hand) and the
colony trains itself on its own history — each generation built from the
evidence of the last.

## API surface

| Method | Path                       | Purpose                                          |
| ------ | -------------------------- | ------------------------------------------------ |
| POST   | `/colony/seed`             | Birth the starter colony (idempotent)            |
| GET    | `/agents`                  | Agent registry + DNA + heartbeats                |
| GET    | `/bots`                    | Bots with balance, strategy, live stats          |
| POST   | `/bots`                    | Create a bot (inherits colony DNA)               |
| GET    | `/strategies`              | Strategies with scores, generation, lineage      |
| GET    | `/trades`                  | Trade history (filter by bot)                    |
| POST   | `/engine/run`              | Run a trading cycle (`{ticks, learn?}`)          |
| POST   | `/engine/learn`            | Run a learning/evolution cycle                   |
| GET    | `/realms`                  | All four realms: mission, status, latest check   |
| POST   | `/realms/invest/audit`     | Invest audit: ledger reconciliation + 4 more     |
| POST   | `/realms/guardian/sweep`   | Guardian sweep: security, privacy, heartbeats    |
| GET    | `/realms/tech/status`      | Tech diagnostics: table counts, tick, statuses   |
| GET    | `/realms/wellness`         | Wellness summary: last, count, 7-day averages    |
| POST   | `/realms/wellness/checkin` | Log a creator check-in (`{mood, energy, note?}`) |
| GET    | `/reports`                 | Observer/Reporter feed (tagged by realm)         |
| GET    | `/goals` `POST/PATCH`      | Colony goals & roadmap tracking (per realm)      |
| GET    | `/analytics/overview`      | Everything the cockpit needs in one call         |
| GET    | `/dash`                    | Lumi — the Creator Cockpit                       |
| GET    | `/`                        | OpenAPI docs (auto-generated)                    |

## Roadmap (seeded as live goals in the Databank)

1. **Prove the loop** — colony seeds, trades, learns, evolves; tests green. ✅ this build
2. **Raise the win rate** — run many cycles, let selection pressure work; tune
   score floor and mutation ranges from evidence.
3. **Live data adapter** — swap the simulated feed for a real market data
   source behind the same `PriceFeed` interface (still paper execution).
4. **Scheduled autonomy** — Cloudflare Cron Trigger runs `engine/run` +
   `engine/learn` on a schedule; the colony trains itself unattended.
5. **Risk gates for real capital** — only after sustained, measured edge:
   drawdown limits, kill-switches, then broker/exchange integration.

## Rules of the build

- No dead code: template demo endpoints (tasks, dummy) removed, not orphaned.
- Every feature lands with an integration test in the same commit.
- Schema changes only via migrations; the Databank is the single source of truth.
- Determinism first: seeded market so every run is reproducible and debuggable.
- Vital core outward: schema → engine → API → visuals, in that order, always shippable.
