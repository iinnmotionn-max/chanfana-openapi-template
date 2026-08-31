-- Migration number: 0004 	 2026-07-07T02:00:00.000Z
-- LUMI EVOLUTION: performance metrics, Lumi's skill progression, and quests.

CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    kind TEXT NOT NULL,
    value REAL NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_metrics_kind ON metrics(kind, id);

-- Lumi's living state: XP per skill, stored in the Databank like everything else.
CREATE TABLE IF NOT EXISTS lumi_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    skills TEXT NOT NULL DEFAULT '{"insight":0,"vigilance":0,"engineering":0,"empathy":0}',
    pulses INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME
);
INSERT INTO lumi_state (id) VALUES (1);

-- Quests: forced-task progression evaluated against real Databank state.
CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    skill TEXT NOT NULL,
    xp_reward INTEGER NOT NULL,
    metric TEXT NOT NULL,
    target REAL NOT NULL,
    progress REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    completed_at DATETIME
);

INSERT INTO quests (title, detail, skill, xp_reward, metric, target) VALUES
    ('Open for business', 'Seed the colony: three bots alive and trading.', 'engineering', 50, 'bots', 3),
    ('First hundred', 'Close 100 trades — evidence before opinion.', 'engineering', 100, 'closed_trades', 100),
    ('Natural selection', 'Retire the first losing strategy.', 'insight', 120, 'retired_strategies', 1),
    ('Third generation', 'Evolve a lineage to generation 3.', 'insight', 150, 'max_generation', 3),
    ('Compounding proof', 'Grow colony equity to 110% of starting capital.', 'insight', 200, 'equity_ratio', 1.1),
    ('Ledger green', 'Pass a full invest audit.', 'vigilance', 80, 'clean_audits', 1),
    ('Clean sweep', 'A guardian sweep with zero warns and zero fails.', 'vigilance', 100, 'clean_sweeps', 1),
    ('Creator bond', 'Three wellness check-ins from the creator.', 'empathy', 100, 'checkins', 3),
    ('Marathon tape', 'Trade through 5,000 market ticks.', 'engineering', 150, 'market_tick', 5000);
