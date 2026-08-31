-- Migration number: 0022
-- RATE LIMITS — brute-force protection for every secret-gated door.
--
-- Constant-time comparison stops an attacker learning a secret one byte at a
-- time. It does nothing to stop them trying a million secrets. This is the
-- other half: a sliding window per bucket, and a lockout once failures pile up.

CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT PRIMARY KEY NOT NULL,   -- e.g. 'auth:rp', 'call:local'
    hits INTEGER NOT NULL DEFAULT 0,
    window_start INTEGER NOT NULL,      -- unix seconds
    locked_until INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
