#!/usr/bin/env bash
# Publish the AETHER coin to Sui and link the Worker to it — one command.
#
# RUN THIS ON YOUR OWN MACHINE, with your own Sui wallet. It signs a real
# transaction with YOUR key and spends YOUR gas. Nothing in this repo (or any
# agent) can or should do that for you.
#
# Usage:
#   ./sui/publish.sh testnet     # do this first — free faucet gas
#   ./sui/publish.sh mainnet     # when you're ready to go truly live
#
# Prereqs:
#   - Sui CLI installed:  https://docs.sui.io/guides/developer/getting-started/sui-install
#   - Node.js (used to parse the publish output; jq NOT required)
#   - An active wallet with gas:  sui client active-address ; sui client gas
#   - (to auto-set Worker secrets) wrangler logged in:  npx wrangler login

set -euo pipefail

# Normalize the network name (accept TESTNET/Devnet/etc.) and validate it.
# BUILD_ENV picks the framework the compiler resolves against — the newer Sui
# CLI requires it and only accepts 'testnet' or 'mainnet' (devnet uses testnet).
NETWORK="$(printf '%s' "${1:-testnet}" | tr '[:upper:]' '[:lower:]')"
case "$NETWORK" in
  testnet|devnet) BUILD_ENV=testnet ;;
  mainnet) BUILD_ENV=mainnet ;;
  *) echo "!! Unknown network '$NETWORK'. Use: testnet (recommended), devnet, or mainnet."; exit 1 ;;
esac
GAS_BUDGET="${GAS_BUDGET:-200000000}"

# Locate the Move package robustly — works whether the script is executed,
# sourced, or run from another directory (BASH_SOURCE/$0 can be unreliable).
SELF="${BASH_SOURCE[0]:-$0}"
HERE="$(cd "$(dirname "$SELF")" 2>/dev/null && pwd || true)"
PKG=""
for cand in "$HERE/aether" "./sui/aether" "$(git rev-parse --show-toplevel 2>/dev/null)/sui/aether"; do
  if [ -f "$cand/Move.toml" ]; then PKG="$(cd "$cand" && pwd)"; break; fi
done
if [ -z "$PKG" ]; then
  echo "!! Could not find sui/aether/Move.toml."
  echo "   Run from the repo root:  bash sui/publish.sh $NETWORK"
  exit 1
fi
ROOT="$(cd "$PKG/../.." && pwd)"

echo "==> Package: $PKG"
echo "==> Target network: $NETWORK"
sui client switch --env "$NETWORK" >/dev/null 2>&1 || {
  echo "No '$NETWORK' env configured in the Sui CLI. Add one, e.g.:"
  echo "  sui client new-env --alias $NETWORK --rpc https://fullnode.$NETWORK.sui.io:443"
  exit 1
}

echo "==> Active address: $(sui client active-address)"
if [ "$NETWORK" != "mainnet" ]; then
  echo "==> Requesting faucet gas (testnet/devnet)…"
  sui client faucet >/dev/null 2>&1 || echo "   (faucet skipped — make sure you have gas)"
fi

echo "==> Building the Move package…"
( cd "$PKG" && sui move build --build-env "$BUILD_ENV" )

echo "==> Publishing (this signs a real transaction and spends gas)…"
OUT="$(cd "$PKG" && sui client publish --gas-budget "$GAS_BUDGET" --build-env "$BUILD_ENV" --json)"

# Parse with Node (always present via npm) so jq isn't required on Windows.
PARSED="$(printf '%s' "$OUT" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{
      const j=JSON.parse(s);
      const ch=j.objectChanges||[];
      const pub=ch.find(c=>c.type==="published");
      const cap=ch.find(c=>c.type==="created"&&/TreasuryCap/.test(c.objectType||""));
      process.stdout.write(((pub&&pub.packageId)||"")+"\t"+((cap&&cap.objectId)||""));
    }catch(e){process.stdout.write("\t");}
  });
')"
PACKAGE_ID="${PARSED%%$'\t'*}"
TREASURY_CAP="${PARSED#*$'\t'}"

if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" = "null" ]; then
  echo "!! Could not parse packageId from publish output. Full output:"
  echo "$OUT"
  exit 1
fi

echo ""
echo "==> Published AETHER on Sui $NETWORK"
echo "    packageId    : $PACKAGE_ID"
echo "    treasuryCap  : $TREASURY_CAP"
echo "    coin type    : ${PACKAGE_ID}::aether::AETHER"
echo "    explorer     : https://suiscan.xyz/$NETWORK/object/$PACKAGE_ID"
echo ""

echo "==> Linking the Worker (setting secrets via wrangler)…"
if command -v npx >/dev/null 2>&1; then
  ( cd "$ROOT" \
    && printf '%s' "$PACKAGE_ID"   | npx wrangler secret put AETHER_PACKAGE_ID \
    && printf '%s' "$TREASURY_CAP" | npx wrangler secret put AETHER_TREASURY_CAP ) \
    && echo "   secrets set." \
    || echo "   (wrangler not ready — set AETHER_PACKAGE_ID / AETHER_TREASURY_CAP manually)"
fi

if [ "$NETWORK" = "mainnet" ]; then
  echo ""
  echo "   Add this to wrangler.jsonc under \"vars\" so the app targets mainnet:"
  echo '     "vars": { "SUI_NETWORK": "mainnet" }'
fi

echo ""
echo "==> Done. Redeploy the Worker to go on-chain:  npm run deploy"
echo "    The AETHER TOKEN panel will flip to '● on-chain' with the live coin type."
