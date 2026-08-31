-- Migration number: 0012 	 2026-07-07T08:30:00.000Z
-- DEFI: the AETHER liquidity layer — a Cetus-style constant-product AMM pool,
-- yield vaults, and collateralised lending, all consolidated under a new
-- 'aether' realm. Supply integrity is preserved: the pool custodies its AETHER
-- in a REAL ledger account ('defi_pool'), and every AETHER movement still flows
-- through transfer()/reward(). The paired "quote" (SUI) side is tracked only as
-- numbers on the pool row — honest: AETHER side is real, quote side synthetic
-- until a real Cetus pool is linked.

INSERT INTO realms (key, title, mission) VALUES
    ('aether', 'Aether', 'The AETHER economy: token ledger, wallet, liquidity pools, vaults, and lending.');

-- The pool's real AETHER custody account. Seeded empty; liquidity providers
-- move their AETHER here through transfer(), so genesis supply stays conserved.
INSERT INTO aether_accounts (owner, kind, balance) VALUES
    ('defi_pool', 'pool', 0);

CREATE TABLE IF NOT EXISTS pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    reserve_aether REAL NOT NULL DEFAULT 0,
    reserve_quote REAL NOT NULL DEFAULT 0,
    lp_supply REAL NOT NULL DEFAULT 0,
    fee_bps INTEGER NOT NULL DEFAULT 30,
    volume REAL NOT NULL DEFAULT 0,
    fees_accrued REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pools (name, reserve_aether, reserve_quote, lp_supply, fee_bps, volume, fees_accrued) VALUES
    ('AETHER/SUI', 0, 0, 0, 30, 0, 0);

CREATE TABLE IF NOT EXISTS lp_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    owner TEXT NOT NULL,
    pool_id INTEGER NOT NULL,
    lp REAL NOT NULL DEFAULT 0,
    updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_lp_positions_owner ON lp_positions(owner, pool_id);

CREATE TABLE IF NOT EXISTS vaults (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    owner TEXT NOT NULL UNIQUE,
    principal REAL NOT NULL DEFAULT 0,
    apr_bps INTEGER NOT NULL DEFAULT 800,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    owner TEXT NOT NULL,
    collateral_aether REAL NOT NULL DEFAULT 0,
    principal_quote REAL NOT NULL DEFAULT 0,
    rate_bps INTEGER NOT NULL DEFAULT 500,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loans_owner ON loans(owner, status);

CREATE TABLE IF NOT EXISTS defi_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    kind TEXT NOT NULL,
    owner TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    detail TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_defi_events_created ON defi_events(id);
