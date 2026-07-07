-- Migration number: 0008 	 2026-07-07T04:10:00.000Z
-- Risk gates: colony-level drawdown / exposure limits with a global halt.
CREATE TABLE IF NOT EXISTS risk_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    max_drawdown REAL NOT NULL DEFAULT 0.25,
    max_open_positions INTEGER NOT NULL DEFAULT 8,
    halted INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    updated_at DATETIME
);
INSERT INTO risk_config (id) VALUES (1);
