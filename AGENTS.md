# AGENTS.md

## Cursor Cloud specific instructions

Cloudflare Worker (Hono + Chanfana + D1 + Vitest). Package manager: **npm** (`package-lock.json`); the startup update script runs `npm install`. Standard commands are in `package.json` scripts and `README.md`.

- Dev server: `npm run dev` seeds the local D1 DB then starts `wrangler dev` on `http://localhost:8787` (Swagger UI at `/`, generated schema at `/openapi.json`, `/tasks` CRUD backed by D1). Runs fully locally (workerd + local D1) — no Cloudflare account or network needed.
- The `dev` script shells out to **pnpm** (`pnpm seedLocalDb && wrangler dev`), so pnpm must be present (it is preinstalled here). Equivalent without pnpm: `npm run seedLocalDb && npx wrangler dev`.
- Tests: `npm run test` runs `wrangler deploy --dry-run` then Vitest via `@cloudflare/vitest-pool-workers` — offline, no account required.
- Local D1 state lives under `.wrangler/state/` (gitignored). Re-run `npm run seedLocalDb` after editing anything in `migrations/`.
- Deploy/remote commands (`npm run deploy`, any `--remote` wrangler call) need Cloudflare credentials and a real `database_id` in `wrangler.jsonc`; not required for local dev/testing.
- No lint step is defined.
