-- Migration number: 0010 	 2026-07-07T05:30:00.000Z
-- AETHER TOKEN: the colony's AI-credit currency (mirrors the Aether token on
-- the Sui blockchain). A fixed-supply ledger — every account balance is backed
-- by a recorded transaction, and total supply never changes (integrity first,
-- because this is money).

CREATE TABLE IF NOT EXISTS aether_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    owner TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'wallet',
    balance REAL NOT NULL DEFAULT 0,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS aether_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    from_owner TEXT NOT NULL,
    to_owner TEXT NOT NULL,
    amount REAL NOT NULL,
    kind TEXT NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aether_ledger_created ON aether_ledger(id);

-- Genesis: a fixed supply of 1,000,000 AETHER, distributed at launch. The sum
-- of all balances must always equal the genesis supply.
INSERT INTO aether_accounts (owner, kind, balance) VALUES
    ('treasury', 'treasury', 800000),
    ('creator', 'creator', 100000),
    ('lumi', 'agent', 60000),
    ('aether', 'agent', 40000);

INSERT INTO aether_ledger (from_owner, to_owner, amount, kind, memo) VALUES
    ('genesis', 'treasury', 800000, 'genesis', 'Genesis reserve'),
    ('genesis', 'creator', 100000, 'genesis', 'Creator allocation'),
    ('genesis', 'lumi', 60000, 'genesis', 'Lumi operating credits'),
    ('genesis', 'aether', 40000, 'genesis', 'Aether scholar grant');
