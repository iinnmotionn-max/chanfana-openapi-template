-- Migration number: 0011 	 2026-07-07T06:00:00.000Z
-- SHIELD: the web3 security & decentralization realm. Red-team scans, smart-
-- contract posture, decentralization scoring, and privacy-first KYC (we store
-- attestations — a level + a hash — never raw identity). A rule-set that grows,
-- so the colony learns to harden itself over time.

INSERT INTO realms (key, title, mission) VALUES
    ('shield', 'Shield', 'Web3 security, red-team, decentralization, and privacy-first KYC. Learns to harden the colony.');

-- Privacy-preserving KYC: an attestation is a level + method + a hash of a
-- proof. No names, no documents, no PII — decentralized identity, not surveillance.
CREATE TABLE IF NOT EXISTS kyc_attestations (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    subject TEXT NOT NULL,
    level TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'self',
    attestation_hash TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Findings from each red-team scan (resolved as posture improves).
CREATE TABLE IF NOT EXISTS shield_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    dimension TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO goals (title, detail, status, priority, progress, realm) VALUES
    ('Harden to 90+', 'Raise the composite security posture to 90 or above.', 'in_progress', 1, 0, 'shield');
