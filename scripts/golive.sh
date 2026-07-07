#!/usr/bin/env bash
# One command to take the Lumi colony live on Cloudflare.
#
# It installs deps, logs you into Cloudflare (a browser window opens — that's
# YOUR login, the one thing only you can do), creates the D1 database, writes
# its id into wrangler.jsonc, applies the migrations, and deploys.
#
# Run from the repo root (Git Bash):  bash scripts/golive.sh

set -uo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
if [ ! -f package.json ]; then
  echo "!! Run this from inside the repo (where package.json lives)."
  exit 1
fi

UUID='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

echo "==> 1/6 Installing dependencies…"
npm install || { echo "!! npm install failed"; exit 1; }

echo "==> 2/6 Logging in to Cloudflare (a browser window will open — approve it)…"
npx wrangler login || { echo "!! wrangler login failed"; exit 1; }

echo "==> 3/6 Creating the D1 database (the Databank)…"
CREATE_OUT="$(npx wrangler d1 create openapi-template-db 2>&1 || true)"
DBID="$(printf '%s' "$CREATE_OUT" | grep -oiE "$UUID" | head -n1 || true)"
if [ -z "$DBID" ]; then
  echo "   (already exists or create was noisy — looking it up…)"
  DBID="$(npx wrangler d1 info openapi-template-db 2>/dev/null | grep -oiE "$UUID" | head -n1 || true)"
fi
if [ -z "$DBID" ]; then
  echo "!! Could not determine the D1 database id. Raw output:"
  echo "$CREATE_OUT"
  echo "   Create it in the Cloudflare dashboard (Workers & Pages -> D1) named"
  echo "   'openapi-template-db', copy its id into wrangler.jsonc, then run:"
  echo "     npm run deploy"
  exit 1
fi
echo "   D1 id: $DBID"

echo "==> 4/6 Writing the D1 id into wrangler.jsonc…"
node -e "const f='wrangler.jsonc';const fs=require('fs');let s=fs.readFileSync(f,'utf8');s=s.replace(/(\"database_id\"\s*:\s*\")[^\"]*(\")/, '\$1$DBID\$2');fs.writeFileSync(f,s);console.log('   done');" \
  || { echo "!! Could not edit wrangler.jsonc — set database_id to $DBID by hand."; exit 1; }

echo "==> 5/6 Applying migrations to the remote Databank…"
npx wrangler d1 migrations apply DB --remote || { echo "!! remote migrations failed"; exit 1; }

echo "==> 6/6 Deploying the Worker…"
npx wrangler deploy || { echo "!! deploy failed"; exit 1; }

echo ""
echo "==> LIVE. Open the workers.dev URL printed above, then add /dash"
echo "    Seed the colony, hit Run + learn, and turn on Autopilot."
