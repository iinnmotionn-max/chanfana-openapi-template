# Cloudflare Workers — what Lumi runs on (agent knowledge)

This is the operating manual for the platform the colony lives on. It's baked
in so any agent (or human) working on this repo follows the same conventions.

## The stack

- **Cloudflare Workers** — the serverless runtime. Entry point: `src/index.ts`
  (a Hono app wrapped by chanfana for OpenAPI). It exports both `fetch`
  (HTTP) and `scheduled` (the cron pulse).
- **D1** — the Databank. A serverless SQLite database, bound as `env.DB`.
  Schema lives in `migrations/` (numbered `NNNN_name.sql`); Wrangler applies
  them in order. Never edit a table by hand — add a migration.
- **Wrangler** — the CLI. Config is `wrangler.jsonc`.

## The two modes

| Goal | Command | Needs Cloudflare login? | Where the data lives |
| ---- | ------- | ----------------------- | -------------------- |
| **Dev** (see it work locally) | `wrangler dev` | no | a local SQLite file |
| **Deploy** (go live) | `wrangler deploy` | yes | your real D1 in the cloud |

Local dev first, always. `bash scripts/dev.sh` does it end to end.

## Rules the agent follows

- **Bindings, not globals.** Reach D1 through `c.env.DB` (the Hono context),
  never a module-level singleton. Secrets/vars come from `c.env` too.
- **Migrations are the only way to change schema.** Add `migrations/NNNN_*.sql`;
  apply with `wrangler d1 migrations apply DB --local` (dev) or `--remote`
  (prod). Migrations must be additive and idempotent (`IF NOT EXISTS`, defaults).
- **No Node built-ins that aren't polyfilled.** Workers is not Node. Use Web
  APIs — `fetch`, `crypto.getRandomValues`, `AbortSignal.timeout`. `nodejs_compat`
  is on (see `wrangler.jsonc` compat flags) but prefer Web APIs.
- **`Date.now()`/`new Date()` are fine at request time**, but never rely on
  wall-clock for determinism — the trading market is seeded, not time-based.
- **Secrets via `wrangler secret put`**, never committed. The Sui link
  (`AETHER_PACKAGE_ID`, `AETHER_TREASURY_CAP`) and the Growth connectors
  (`X_TOKEN`, …) are read from `c.env` and degrade gracefully when absent.
- **Cache correctness matters for a live dashboard.** The app sets
  `Cache-Control: no-store` and the client cache-busts reads, so the cockpit
  never shows stale data.
- **Cron = autonomy.** `wrangler.jsonc` has `triggers.crons: ["0 * * * *"]`;
  the `scheduled` handler pulses Lumi hourly once deployed.
- **Every change ships with a test.** `npm test` runs `wrangler deploy --dry-run`
  (a real bundle check, no auth) plus the Vitest workers-pool suite.

## The commands, verbatim

```bash
# dev (local, no account)
npm install
npx wrangler d1 migrations apply DB --local
npx wrangler dev                       # http://localhost:8787/dash

# deploy (live)
npx wrangler login                     # browser popup — your auth
npx wrangler d1 create openapi-template-db   # once; put the id in wrangler.jsonc
npx wrangler d1 migrations apply DB --remote
npm run deploy                         # predeploy applies remote migrations, then deploys

# secrets (optional integrations)
npx wrangler secret put AETHER_PACKAGE_ID    # after publishing on Sui
npx wrangler secret put X_TOKEN              # makes the Growth X connector live

# observe
npx wrangler tail                      # live logs from the deployed Worker
```

`scripts/dev.sh` and `scripts/golive.sh` wrap the dev and deploy flows into one
command each.
