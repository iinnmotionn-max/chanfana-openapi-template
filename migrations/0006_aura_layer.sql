-- Migration number: 0006 	 2026-07-07T03:30:00.000Z
-- AURA LAYER: personality + design profiles of the people the colony works
-- with (clients, brands, users, investors) so Lumi personalizes her work.
-- Privacy is structural: notes require consent, the Guardian scans for PII,
-- and the creator is never profiled.

CREATE TABLE IF NOT EXISTS auras (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    personality TEXT NOT NULL DEFAULT '',
    traits TEXT NOT NULL DEFAULT '{}',
    notes TEXT NOT NULL DEFAULT '',
    consent INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

INSERT INTO quests (title, detail, skill, xp_reward, metric, target) VALUES
    ('First aura', 'Profile a client, brand, user, or investor — with consent.', 'empathy', 80, 'auras', 1);
