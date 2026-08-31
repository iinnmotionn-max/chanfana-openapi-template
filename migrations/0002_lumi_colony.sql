-- Migration number: 0002 	 2026-07-07T00:00:00.000Z
-- LUMI COLONY: replace the template demo with the colony Databank.

DROP TABLE IF EXISTS tasks;

CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    dna TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    last_seen DATETIME
);

CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    params TEXT NOT NULL DEFAULT '{}',
    generation INTEGER NOT NULL DEFAULT 1,
    parent_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    soul TEXT NOT NULL DEFAULT '{}',
    strategy_id INTEGER NOT NULL,
    symbol TEXT NOT NULL DEFAULT 'SIM-BTC',
    balance REAL NOT NULL DEFAULT 1000,
    starting_balance REAL NOT NULL DEFAULT 1000,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    bot_id INTEGER NOT NULL,
    strategy_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty REAL NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL,
    pnl REAL,
    outcome TEXT NOT NULL DEFAULT 'open',
    reason TEXT NOT NULL DEFAULT '',
    opened_at_tick INTEGER NOT NULL,
    closed_at_tick INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trades_bot ON trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    author TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    priority INTEGER NOT NULL DEFAULT 3,
    progress REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS market_state (
    symbol TEXT PRIMARY KEY NOT NULL,
    tick INTEGER NOT NULL DEFAULT 0,
    price REAL NOT NULL,
    seed INTEGER NOT NULL
);

-- Seed the core intelligences and their DNA.
INSERT INTO agents (name, role, dna) VALUES
    ('lumi', 'frontend-intellect', '{"curiosity":0.9,"patience":0.6,"risk":0.3}'),
    ('reg', 'backend-operator', '{"discipline":0.9,"patience":0.8,"risk":0.4}'),
    ('databank', 'memory', '{"discipline":1.0,"patience":1.0,"risk":0.1}'),
    ('observer', 'performance-watch', '{"discipline":0.95,"patience":0.7,"risk":0.2}'),
    ('reporter', 'chronicler', '{"curiosity":0.8,"patience":0.9,"risk":0.2}');

-- Seed the roadmap as live goals so the dash shows the plan from day one.
INSERT INTO goals (title, detail, status, priority, progress) VALUES
    ('Prove the loop', 'Colony seeds, trades, learns, evolves; tests green.', 'in_progress', 1, 0.8),
    ('Raise the win rate', 'Run many cycles; let selection pressure retire losers and evolve winners.', 'open', 1, 0),
    ('Live data adapter', 'Swap simulated feed for real market data behind the same PriceFeed interface.', 'open', 2, 0),
    ('Scheduled autonomy', 'Cron Trigger runs engine/run + engine/learn unattended.', 'open', 2, 0),
    ('Risk gates for real capital', 'Only after sustained measured edge: drawdown limits, kill-switches.', 'open', 3, 0);
