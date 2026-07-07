-- Migration number: 0016 	 2026-07-07T08:00:00.000Z
-- Invest IS Aether: merge the two realms into one. The trading colony and the
-- AETHER token economy are one and the same — the colony earns, holds, and
-- settles in AETHER. Keep the internal key 'invest' (so every report, goal,
-- audit, and endpoint keeps working) but present it as the Aether realm, and
-- retire the separate 'aether' card.

UPDATE realms
SET title = 'Aether',
    mission = 'The Aether economy: self-improving trading, the AETHER token ledger, the wallet, liquidity pools, vaults, lending, and on-chain settlement on Sui.'
WHERE key = 'invest';

DELETE FROM realms WHERE key = 'aether';
