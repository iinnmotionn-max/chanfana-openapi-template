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

echo "==> 1/7 Installing dependencies…"
npm install || { echo "!! npm install failed"; exit 1; }

echo "==> 2/7 Logging in to Cloudflare (a browser window will open — approve it)…"
npx wrangler login || { echo "!! wrangler login failed"; exit 1; }

echo "==> 3/7 Creating the D1 database (the Databank)…"
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

echo "==> 4/7 Writing the D1 id into wrangler.jsonc…"
node -e "const f='wrangler.jsonc';const fs=require('fs');let s=fs.readFileSync(f,'utf8');s=s.replace(/(\"database_id\"\s*:\s*\")[^\"]*(\")/, '\$1$DBID\$2');fs.writeFileSync(f,s);console.log('   done');" \
  || { echo "!! Could not edit wrangler.jsonc — set database_id to $DBID by hand."; exit 1; }

echo "==> 5/7 Applying migrations to the remote Databank…"
npx wrangler d1 migrations apply DB --remote || { echo "!! remote migrations failed"; exit 1; }

echo "==> 6/7 Setting the creator key…"
# Without this the deployed Worker refuses to spend, publish, act unattended,
# or reach your machine — for everyone, including you. That is the safe
# default for a URL anyone could find, but it must be a deliberate choice,
# not something you discover later from a 503.
echo ""
echo "    Your Worker URL is not a secret. The creator key is what stops"
echo "    anyone who finds it from granting themselves your machine and"
echo "    spending your AETHER."
echo ""
read -r -p "    Set CREATOR_KEY now? [Y/n] " SETKEY
SETKEY="${SETKEY:-Y}"
if [ "$SETKEY" = "Y" ] || [ "$SETKEY" = "y" ]; then
  # Offer a strong one rather than inviting a memorable, guessable string.
  SUGGESTED="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))" 2>/dev/null || true)"
  if [ -n "$SUGGESTED" ]; then
    echo ""
    echo "    Suggested key (copy it somewhere safe FIRST — it is not stored anywhere else):"
    echo ""
    echo "      $SUGGESTED"
    echo ""
  fi
  echo "    Paste your chosen key at the prompt:"
  npx wrangler secret put CREATOR_KEY || echo "   !! Skipped. Set it later: npx wrangler secret put CREATOR_KEY"
else
  echo "   Skipped. Until you run 'npx wrangler secret put CREATOR_KEY', the"
  echo "   deployed system will refuse to spend, publish, act unattended, or"
  echo "   reach a machine — for anyone, including you."
fi

echo "==> 7/7 Deploying the Worker…"
npx wrangler deploy || { echo "!! deploy failed"; exit 1; }

echo ""
echo "==> LIVE. Open the workers.dev URL printed above, then add /dash"
echo "    Seed the colony, hit Run + learn, and turn on Autopilot."
echo ""
echo "    Check what is still unwired at any time:"
echo "      curl https://<your-worker>/ready"
echo ""
echo "    Everything else is optional and off until you set it — Claude"
echo "    (ANTHROPIC_API_KEY), open models (HF_TOKEN), the machine bridge"
echo "    (LOCAL_AGENT_SECRET), the Roblox city (RP_SHARED_SECRET), and"
echo "    publishing (X_TOKEN / LINKEDIN_TOKEN). Each reports itself offline"
echo "    until configured rather than pretending to work."
