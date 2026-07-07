# Lumi Colony — self-improving paper-trading system

A colony of trading bots that **records every trade, learns from its own
history, retires losers, evolves winners, and compounds capital** — built on
Cloudflare Workers, [Hono](https://hono.dev), [chanfana](https://chanfana.com)
(OpenAPI 3.1 auto-generation + validation), and a D1 database.

Full design: **[docs/BLUEPRINT.md](docs/BLUEPRINT.md)**.

| Agent        | Role                                                        | Where                  |
| ------------ | ----------------------------------------------------------- | ---------------------- |
| **Lumi**     | Front-end intellect — the creator dashboard                 | `GET /dash`            |
| **Reg**      | Back-end operator — engine, execution, records              | the API                |
| **Databank** | Memory — every bot, trade, lesson, report, goal             | D1 (`migrations/`)     |
| **Observer** | Scores strategies on real trade evidence                    | `POST /engine/learn`   |
| **Reporter** | Files a report after every cycle and learning pass          | `GET /reports` + dash  |

> **Paper trading only.** The market is a deterministic seeded simulation —
> no exchange keys, no real funds. Prove the edge here first; the live-data
> adapter is a roadmap goal, gated behind measured results.

## Quick start (local)

```bash
npm install
npx wrangler d1 migrations apply DB --local   # build the Databank
npx wrangler dev                              # start Reg
```

Then:

1. Open **http://localhost:8787/dash** — Lumi, the creator dashboard.
2. Click **Seed colony** — births generation-1 strategies and bots with colony DNA.
3. Click **Run cycle** — the market advances, every bot signals and trades.
4. Click **Learn** — the Observer scores everything; losers retire, the champion evolves.
5. Repeat 3–4 and watch the colony select toward what actually wins.

The same loop over HTTP:

```bash
curl -X POST localhost:8787/colony/seed
curl -X POST localhost:8787/engine/run -H 'Content-Type: application/json' -d '{"ticks":400}'
curl -X POST localhost:8787/engine/learn
curl localhost:8787/analytics/overview
```

OpenAPI docs are auto-generated at `/` (extract the schema with `npm run schema`).

## Deploy

```bash
npx wrangler d1 create openapi-template-db   # once; update database_id in wrangler.jsonc
npm run deploy                                # applies remote migrations, then deploys
```

For unattended self-training, add a [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
that POSTs `/engine/run` and `/engine/learn` on a schedule (roadmap goal #4).

## Testing

```bash
npm test
```

Integration tests in `tests/integration/colony.test.ts` cover the whole loop:
seeding, trading, tape continuity across cycles, learning/evolution/lineage,
bot DNA inheritance, goals, analytics, and the dashboard.

## Project structure

```
migrations/            Databank schema + seeded agents, DNA, and roadmap goals
src/engine/market.ts   Deterministic seeded price series (reproducible)
src/engine/strategies.ts  SMA-cross, momentum, mean-reversion + mutation
src/engine/trader.ts   Trading cycle: signals → trades → compounding balances
src/engine/learning.ts Observer scoring, retire/evolve/reassign
src/engine/colony.ts   Idempotent colony seeding
src/endpoints/         Reg's API (chanfana OpenAPI routes)
src/dash/              Lumi — self-contained dashboard (no CDNs, no build step)
tests/integration/     Full-loop tests (Vitest + workers pool)
```
