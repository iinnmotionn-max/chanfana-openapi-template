-- Migration number: 0023
-- ROTATION EVENTS — every call that authenticated on an OUTGOING secret.
--
-- During a rotation both the current and previous secret are accepted, so the
-- bridge never goes down. The risk is forgetting to close the window: two
-- valid secrets, indefinitely. Recording each legacy call makes the window
-- visible — Shield can then say "nobody has used the old key in a week, you
-- can remove it" or "three callers still depend on it, don't remove it yet".

CREATE TABLE IF NOT EXISTS rotation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    bridge TEXT NOT NULL,
    host TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rotation_bridge ON rotation_events(bridge, created_at);
