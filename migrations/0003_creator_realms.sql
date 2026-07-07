-- Migration number: 0003 	 2026-07-07T01:00:00.000Z
-- CREATOR REALMS: Lumi oversees multiple realms; Invest is one of them.
-- Reg's other jobs — protection, security, privacy, tech, wellness — get
-- their own realms, all served by the same Databank.

CREATE TABLE IF NOT EXISTS realms (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    mission TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'nominal',
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    realm TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_checks_realm ON checks(realm, id);

CREATE TABLE IF NOT EXISTS wellness_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    mood INTEGER NOT NULL,
    energy INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reports ADD COLUMN realm TEXT NOT NULL DEFAULT 'invest';
ALTER TABLE goals ADD COLUMN realm TEXT NOT NULL DEFAULT 'invest';

INSERT INTO realms (key, title, mission) VALUES
    ('invest', 'Invest', 'Grow paper capital with flawless ledger integrity and active learning. Money moves only with a record.'),
    ('guardian', 'Guardian', 'Protection, security, and privacy — the man around the house. Sweeps the whole system for anything wrong.'),
    ('tech', 'Tech', 'Dev and tech support: diagnostics, system health, keeping every realm running.'),
    ('wellness', 'Wellness', 'Check in on the creator: mood, energy, streaks. The colony works for a human.');

INSERT INTO goals (title, detail, status, priority, progress, realm) VALUES
    ('Ledger integrity always green', 'Every audit passes: balances reconcile to recorded trades, no exceptions.', 'in_progress', 1, 0, 'invest'),
    ('Protection sweep cadence', 'Guardian sweep runs with every cycle; zero unresolved fails.', 'in_progress', 1, 0, 'guardian'),
    ('Full diagnostics coverage', 'Tech status reflects every realm and every table in the Databank.', 'in_progress', 2, 0.5, 'tech'),
    ('Creator check-in streak', 'A wellness check-in logged regularly; Lumi watches the trend.', 'open', 2, 0, 'wellness');
