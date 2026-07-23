# InMotion RP — Roblox × AETHER bridge kit

Server-side Luau that connects your Roblox roleplay city to the Lumi AETHER
economy. Players earn **real ledger AETHER** (conserved supply, treasury-capped)
for in-city work; balances show in leaderstats.

## What's here

| File | Goes in | What it does |
|---|---|---|
| `server/AetherBridge.lua` | ServerScriptService (ModuleScript) | `grant()`, `spend()`, `balance()` — calls the Worker's `/rp/grant`, `/rp/spend`, `/rp/player/:id` |
| `server/Paychecks.server.lua` | ServerScriptService (Script) | Pays every player 25 AETHER each 10 min + AETHER leaderstats |
| `server/Shop.server.lua` | ServerScriptService (Script) | Server-authoritative shop: `BuyItem` RemoteFunction, ledger-confirmed purchases, catalog in AETHER |

## Setup (5 steps, ~5 minutes)

1. **Deploy the Worker** (if you haven't): `bash scripts/golive.sh` from the
   repo root on your machine. Note your URL: `https://<name>.<you>.workers.dev`.
2. **Set the bridge secret** on the Worker (your machine, Git Bash):
   ```bash
   npx wrangler secret put RP_SHARED_SECRET
   # paste a long random string when prompted
   ```
   Until this is set the bridge answers 503 — off by default, by design.
3. **In Roblox Studio**: Game Settings → Security → **Allow HTTP Requests: ON**.
4. **Add the scripts**: create a **ModuleScript** named `AetherBridge` in
   `ServerScriptService`, paste `server/AetherBridge.lua` into it, and set
   `AetherBridge.BaseUrl` to your Worker URL. Then create a **Script** named
   `Paychecks` next to it and paste `server/Paychecks.server.lua`.
5. **Store the secret in the game**: in `ServerStorage`, add a **StringValue**
   named `RP_SHARED_SECRET` and set its Value to the same secret from step 2.
   (ServerStorage never replicates to clients.)

Play-test: after 10 minutes on the server, players get their first paycheck and
their AETHER leaderstat updates from the live ledger.

## Honesty & safety rules (already enforced)

- **The game can never mint.** Grants flow treasury → player via the ledger's
  `reward()`, capped at what the treasury holds. The Guardian's supply audit
  keeps proving total supply == genesis.
- **Off until configured.** No `RP_SHARED_SECRET` on the Worker → 503. No
  StringValue in ServerStorage → the bridge module refuses locally.
- **Server-only.** Never move `AetherBridge` to ReplicatedStorage; the secret
  StringValue lives in ServerStorage precisely because clients can't read it.
- **Fail-quiet.** If the Worker is unreachable, the city keeps running and
  paychecks skip with one warning — nothing pretends to be paid.

## Extend it

Pay from any server script:

```lua
local AetherBridge = require(game.ServerScriptService.AetherBridge)
AetherBridge.grant(player.UserId, player.Name, 100, "heist-completed")
```

Charge for anything (the sale only completes if the ledger accepts it):

```lua
local ok, newBalance = AetherBridge.spend(player.UserId, 250, "car-dealership")
if ok then --[[ hand over the car ]] end
```

Reasons land in the ledger memo (`rp:<reason>`), so the cockpit's Aether panel
and `/aether/ledger` show exactly what the city paid for. Player wallets appear
in the cockpit WALLET panel as `rp-<userId>` (kind `rp`). The loop is closed:
paychecks flow treasury → players, purchases flow players → treasury, and the
Guardian audit proves total supply never drifts.
