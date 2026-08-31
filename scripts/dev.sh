#!/usr/bin/env bash
# Run the Lumi colony LOCALLY (dev mode) — no Cloudflare account, no deploy.
# A local D1 database is created on your machine; nothing goes to the cloud.
#
# Run from the repo root (Git Bash):  bash scripts/dev.sh

set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
[ -f package.json ] || { echo "!! Run this from inside the repo (where package.json lives)."; exit 1; }

echo "==> 1/3 Installing dependencies…"
npm install || { echo "!! npm install failed"; exit 1; }

echo "==> 2/3 Building the local Databank (D1 migrations, local only)…"
npx wrangler d1 migrations apply DB --local || { echo "!! local migrations failed"; exit 1; }

echo "==> 3/3 Starting the dev server…"
echo "    When it says 'Ready', open:  http://localhost:8787/dash"
echo "    (Ctrl+C to stop.)"
npx wrangler dev
