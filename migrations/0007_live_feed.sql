-- Migration number: 0007 	 2026-07-07T04:00:00.000Z
-- Live price feed: banked real-world observations + per-symbol feed mode.
ALTER TABLE market_state ADD COLUMN feed TEXT NOT NULL DEFAULT 'sim';
CREATE TABLE IF NOT EXISTS live_ticks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    symbol TEXT NOT NULL,
    price REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'coingecko',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_live_ticks_symbol ON live_ticks(symbol, id);
