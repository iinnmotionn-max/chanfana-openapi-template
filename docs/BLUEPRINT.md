# LUMI COLONY — System Blueprint

A self-improving paper-trading colony built on Cloudflare Workers + D1.
Three core intelligences working as one unit:

| Agent        | Role                                                                          | Where it lives                     |
| ------------ | ----------------------------------------------------------------------------- | ---------------------------------- |
| **Lumi**     | Front-end intellect. The creator dashboard: visuals, goals, live reports.     | `GET /dash` (`src/dash/`)           |
| **Reg**      | Back-end operator. Runs the engine, executes cycles, records everything.      | API endpoints (`src/endpoints/`)    |
| **Databank** | Memory. Every bot, strategy, trade, lesson, report, and goal — nothing lost.  | D1 database (`migrations/`)         |
| **Observer** | Watches every cycle, measures performance.                                    | `src/engine/learning.ts` (metrics)  |
| **Reporter** | Writes a report into the Databank after every cycle and learning pass.        | `reports` table + dash feed         |

## Why the bots were losing (and how this fixes it)

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

## Safety stance

- **Paper trading only.** Deterministic simulated market (seeded random walk).
  No exchange keys, no real funds. The identical engine interface is where a
  live-data adapter plugs in later — after the win rate is proven here.
- Nothing here guarantees market profits; it guarantees the machinery to
  measure honestly, cut losers fast, and compound what works.

## Architecture (vital core → outward)

```
migrations/            Databank schema (agents, strategies, bots, trades,
                       reports, goals, market_state) + seed colony DNA
src/engine/market.ts   Deterministic seeded price series (reproducible ticks)
src/engine/strategies.ts  SMA-cross, momentum, mean-reversion (parameterized)
src/engine/trader.ts   Runs a cycle: signals → executes → records trades,
                       compounds balances, Reporter writes cycle report
src/engine/learning.ts Observer metrics + retire/evolve/reassign + report
src/endpoints/         Reg's API: colony, bots, strategies, trades, reports,
                       goals, engine (run/learn), analytics
src/dash/              Lumi: self-contained creator dashboard (charts, feed,
                       goals, colony status) — auto-refreshing visuals
tests/integration/     Full-loop tests: seed → trade → learn → evolve
```

## The flow (how the agents hand off to each other)

```
POST /colony/seed      Reg births the starter colony from agent DNA
POST /engine/run       Reg advances the market N ticks; every active bot
                       signals, trades, and compounds; Reporter files a
                       cycle report into the Databank
POST /engine/learn     Observer scores every strategy from trade history;
                       retires losers, evolves the champion, reassigns bots;
                       Reporter files a learning report
GET  /dash             Lumi reads the Databank through Reg's analytics and
                       renders the creator dashboard
```

Run cycles and learning passes repeatedly (cron, CI, or by hand) and the
colony trains itself on its own history — each generation built from the
evidence of the last.

## API surface

| Method | Path                  | Purpose                                        |
| ------ | --------------------- | ---------------------------------------------- |
| POST   | `/colony/seed`        | Birth the starter colony (idempotent)          |
| GET    | `/agents`             | Agent registry + DNA                           |
| GET    | `/bots`               | Bots with balance, strategy, live stats        |
| POST   | `/bots`               | Create a bot (inherits colony DNA)             |
| GET    | `/strategies`         | Strategies with scores, generation, lineage    |
| GET    | `/trades`             | Trade history (filter by bot)                  |
| POST   | `/engine/run`         | Run a trading cycle (`{ticks}`)                |
| POST   | `/engine/learn`       | Run a learning/evolution cycle                 |
| GET    | `/reports`            | Observer/Reporter feed                         |
| GET    | `/goals` `POST/PATCH` | Colony goals & roadmap tracking                |
| GET    | `/analytics/overview` | Everything the dashboard needs in one call     |
| GET    | `/dash`               | Lumi — the creator dashboard                   |
| GET    | `/`                   | OpenAPI docs (auto-generated)                  |

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
