# Lumi Colony — a multi-realm creator AI

Lumi is a creator AI that watches over four realms — **Invest, Guardian,
Tech, Wellness** — from one **Creator Cockpit**. The Invest realm is a colony
of trading bots that **records every trade, learns from its own history,
retires losers, evolves winners, and compounds paper capital** — built on
Cloudflare Workers, [Hono](https://hono.dev), [chanfana](https://chanfana.com)
(OpenAPI 3.1 auto-generation + validation), and a D1 database.

Full design: **[docs/BLUEPRINT.md](docs/BLUEPRINT.md)**.

| Realm        | Mission                                                                    | Entry points                                   |
| ------------ | -------------------------------------------------------------------------- | ---------------------------------------------- |
| **Invest**   | Flawless ledger integrity + active learning — it handles (paper) money     | `POST /engine/run`, `POST /realms/invest/audit` |
| **Guardian** | Protection, security, privacy — "the man around the house"                 | `POST /realms/guardian/sweep`                  |
| **Tech**     | Dev/tech support diagnostics: system health across every realm             | `GET /realms/tech/status`                      |
| **Wellness** | Creator check-ins: mood, energy, streaks — the colony works for a human    | `POST /realms/wellness/checkin`                |

## Lumi is alive

Lumi levels up by doing her jobs — four skills (**Insight, Vigilance,
Engineering, Empathy**), XP from real work, a seeded **quest line**, and
**situational awareness**: every pulse she assesses her stage, picks the
initiative closest to done, sets herself a live goal, and pursues it until
complete. Her skill levels feed back into the engine — Insight widens
mutation and breeds bigger broods; Engineering raises trading throughput.

- `POST /lumi/pulse` — one heartbeat: trade → learn → audit → sweep → quests → initiative
- `GET /lumi` — her profile, awareness statement, quests, engine performance
- `POST /lumi/research {query}` — expedition to the Hugging Face Hub (free API); findings banked in `GET /knowledge`
- `POST /lumi/scout` — live market snapshot (CoinGecko, free)
- `GET/POST /auras` + `GET /auras/:id/brief` — the **Aura layer**: personality/design
  profiles of clients, brands, users, investors so work is personalized.
  Privacy is structural: notes require consent, the Guardian scans for PII,
  and **the creator is never profiled**.
- **Autopilot** in the cockpit pulses her continuously; deployed, a Cron
  Trigger (`wrangler.jsonc`) pulses her hourly, unattended.
- **Command Center** in the cockpit: quick signals (`pulse`, `advance 600`,
  `audit`, `sweep`, `research <q>`, `scout`, `aura add …`, `pause <bot>`,
  `checkin 4 3 …` — type `help`).

| Agent        | Role                                                        | Where                  |
| ------------ | ----------------------------------------------------------- | ---------------------- |
| **Lumi**     | Front-end intellect — the Creator Cockpit                   | `GET /dash`            |
| **Reg**      | Back-end operator — engine, execution, records              | the API                |
| **Databank** | Memory — every bot, trade, lesson, report, goal, check      | D1 (`migrations/`)     |
| **Observer** | Scores strategies on real trade evidence                    | `POST /engine/learn`   |
| **Reporter** | Files a report after every cycle, audit, sweep, and check-in | `GET /reports` + dash |

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

1. Open **http://localhost:8787/dash** — Lumi, the Creator Cockpit.
2. Click **Seed colony** — births generation-1 strategies and bots with colony DNA.
3. Click **Run cycle** — the market advances, every bot signals and trades.
4. Click **Learn** — the Observer scores everything; losers retire, the champion evolves.
5. Repeat 3–4 and watch the colony select toward what actually wins.

The same loop over HTTP, plus the other realms:

```bash
curl -X POST localhost:8787/colony/seed
curl -X POST localhost:8787/engine/run -H 'Content-Type: application/json' -d '{"ticks":400,"learn":true}'
curl -X POST localhost:8787/realms/invest/audit        # ledger reconciliation + trade validity
curl -X POST localhost:8787/realms/guardian/sweep      # security/privacy sweep across the system
curl localhost:8787/realms/tech/status                 # diagnostics: table counts, tick, realm statuses
curl -X POST localhost:8787/realms/wellness/checkin -H 'Content-Type: application/json' -d '{"mood":4,"energy":3,"note":"good day"}'
curl localhost:8787/realms                             # all four realms at a glance
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
(One is already configured in `wrangler.jsonc` — Lumi pulses herself hourly on deploy.)

### Auto-deploy (CI)

`.github/workflows/deploy.yml` deploys on every push to `main` once you add two
repo secrets — `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — and set your
D1 `database_id` in `wrangler.jsonc`. Then "go live" is a merge.
`.github/workflows/ci.yml` runs typecheck + the full test suite on every PR.

To publish the AETHER token on Sui, run `./sui/publish.sh testnet` (then
`mainnet`) with your own wallet — see `docs/AETHER_SUI.md`.

## Testing

```bash
npm test
```

Integration tests in `tests/integration/colony.test.ts` cover the Invest loop:
seeding, trading, tape continuity across cycles, learning/evolution/lineage,
bot DNA inheritance, goals, analytics, and the cockpit.
`tests/integration/realms.test.ts` covers the realms: the invest audit
(including a deliberately corrupted ledger), the guardian sweep and privacy
scan, tech diagnostics, wellness check-ins, inline learning, the kill-switch
bookkeeping, and the realm-aware analytics overview.

## Project structure

```
migrations/            Databank schema + seeded agents, DNA, realms, and goals
src/engine/market.ts   Deterministic seeded price series (reproducible)
src/engine/strategies.ts  SMA-cross, momentum, mean-reversion + mutation
src/engine/trader.ts   Trading cycle: signals → trades → compounding balances
src/engine/learning.ts Observer scoring, retire/evolve/reassign
src/engine/colony.ts   Idempotent colony seeding
src/endpoints/         Reg's API (chanfana OpenAPI routes), incl. `/realms/*`
src/dash/              Lumi — the Creator Cockpit (no CDNs, no build step)
tests/integration/     Full-loop + realm tests (Vitest + workers pool)
```
