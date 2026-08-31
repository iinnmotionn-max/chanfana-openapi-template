# Taking AETHER live on the Sui blockchain

The Aether token ships in two layers:

1. **Off-chain ledger** (`src/engine/token.ts`) — the fast operational
   AI-credit ledger inside the Databank. Live the moment the Worker deploys.
2. **On-chain coin** (`sui/aether/`) — the real `AETHER` coin on Sui. This
   requires **your** Sui wallet, gas, and a signed publish transaction, so it
   is not something the Worker (or this agent) can do for you — it would mean
   holding your keys and spending real gas. You publish it; the Worker then
   links to it.

Until you publish, the cockpit shows **"off-chain ledger · not yet published
to Sui"** and the Databank ledger is the source of truth. That is honest, not
a stub pretending to be on-chain.

## Publish the coin (you run these)

Prerequisites: the [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
and a wallet with gas on your target network.

```bash
# 1. Fund a wallet (testnet faucet, or real SUI for mainnet)
sui client active-address
sui client faucet            # testnet/devnet only

# 2. Build & publish the Move package
cd sui/aether
sui move build
sui client publish --gas-budget 200000000
```

From the publish output, record:

- **`packageId`** — the published package (the `Published Objects` entry).
- **`TreasuryCap<AETHER>`** object id — created and transferred to you; controls
  mint/burn.
- The coin type is `` `<packageId>::aether::AETHER` ``.

Publishing mints the full **genesis supply of 1,000,000 AETHER (9 decimals)**
to your address, matching the off-chain ledger's genesis.

## Link the Worker to the chain

Set these as Worker vars/secrets, then redeploy:

```bash
npx wrangler secret put AETHER_PACKAGE_ID     # the published packageId
npx wrangler secret put AETHER_TREASURY_CAP   # the TreasuryCap object id
# optional (defaults to testnet):
#   add "SUI_NETWORK": "mainnet" under "vars" in wrangler.jsonc
```

The adapter (`src/engine/sui.ts`) reads these and flips the token to
**linked**: `GET /aether/chain` and the cockpit panel then show the live coin
type, network, and a Suiscan explorer link.

## Mint / burn on-chain (treasury operations)

With the `TreasuryCap`:

```bash
# mint 1000 AETHER (1000 * 10^9 base units) to an address
sui client call --package <packageId> --module aether --function mint \
  --args <TreasuryCap_id> 1000000000000 <recipient_address> --gas-budget 20000000

# burn a coin object back to the reserve
sui client call --package <packageId> --module aether --function burn \
  --args <TreasuryCap_id> <coin_object_id> --gas-budget 20000000
```

Transfers use Sui's native `Coin<AETHER>` — any wallet can send it, no custom
contract call needed.

## Design note

The off-chain ledger and the on-chain coin share one genesis supply
(1,000,000) and one integrity rule (supply is conserved; the Guardian sweep's
`aether-supply` check enforces it off-chain, and Sui's `TreasuryCap` enforces
it on-chain). The adapter is where the two settle against each other — the same
pattern as the live-market data adapter: real interface now, real settlement
when you provide the keys.
