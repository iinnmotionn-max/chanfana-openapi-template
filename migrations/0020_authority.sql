-- Migration number: 0020
-- AUTHORITY — what Lumi is permitted to do on her own, and the record of
-- everything she did with that permission. Jarvis serves at the creator's
-- pleasure: every capability sits behind a scope the creator grants or revokes.

CREATE TABLE IF NOT EXISTS authority (
    scope TEXT PRIMARY KEY NOT NULL,   -- 'observe' | 'operate' | 'spend' | 'publish' | 'command'
    granted INTEGER NOT NULL DEFAULT 0,
    detail TEXT NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Read-only and internal operations start granted; anything that moves value
-- or speaks to the outside world starts REVOKED until the creator says so.
INSERT INTO authority (scope, granted, detail) VALUES
    ('observe', 1, 'Read every realm: status, ledgers, reports, knowledge.'),
    ('operate', 1, 'Run the engine: trade cycles, learning, audits, sweeps, study, scans.'),
    ('spend',   0, 'Move AETHER: transfers, rewards, DeFi, RP grants. Off until granted.'),
    ('publish', 0, 'Speak outward: publish posts through live connectors. Off until granted.'),
    ('command', 0, 'Act unattended on her own initiative during a pulse. Off until granted.');
