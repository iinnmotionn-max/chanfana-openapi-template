-- Migration number: 0013 	 2026-07-07T09:30:00.000Z
-- WALLET: a real in-app web3 wallet layered over the AETHER token ledger. A
-- wallet IS an aether_accounts row (kind='wallet'); creating one adds a row with
-- balance 0, so the fixed genesis supply (1,000,000) stays conserved — all value
-- still moves through transfer(). Each account gains a chain-style receive
-- address and an optional linked self-custody Sui address.

ALTER TABLE aether_accounts ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE aether_accounts ADD COLUMN sui_address TEXT NOT NULL DEFAULT '';

-- Give the genesis accounts a deterministic address so they surface as wallets.
UPDATE aether_accounts SET address = '0x' || substr(lower(hex(owner)), 1, 16) WHERE address = '';

CREATE INDEX IF NOT EXISTS idx_aether_accounts_address ON aether_accounts(address);
