-- Migration number: 0024
-- BRIDGE CALLERS — who is actually walking through each inbound door.
--
-- Rate limiting catches someone GUESSING a secret. Rotation lets you replace a
-- secret you know has leaked. Neither covers the quiet case: a valid secret,
-- copied rather than guessed, used by a machine that isn't yours. That traffic
-- is indistinguishable from legitimate traffic — unless you know which callers
-- are normal.
--
-- So every authenticated call records who made it. Once a bridge has an
-- established caller, a NEW one is worth a look. Not an alarm: you might have
-- just set up a second machine. A question the system asks once, that you
-- answer by trusting the caller.
--
-- HONEST LIMIT, stated here because it matters: `caller` is self-reported by
-- the client. Someone holding a stolen secret can claim an existing name and
-- blend in. This is a detection aid, not authentication — it raises the cost
-- of quiet misuse, it does not prevent it. The secret is still the only thing
-- actually guarding the door.

CREATE TABLE IF NOT EXISTS bridge_callers (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    bridge TEXT NOT NULL,
    caller TEXT NOT NULL,
    trusted INTEGER NOT NULL DEFAULT 0,
    calls INTEGER NOT NULL DEFAULT 0,
    first_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bridge_caller ON bridge_callers(bridge, caller);
