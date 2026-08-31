-- Migration number: 0018
-- GAMING REALM — InMotion RP graduates from a bridge into its own realm.
-- The Roblox city runs on the same conserved AETHER ledger, but it is its own
-- domain with its own mission, status, goals, and reports (realm='gaming').

INSERT INTO realms (key, title, mission) VALUES
    ('gaming', 'Gaming', 'InMotion RP — the Roblox city. Citizens earn and spend conserved AETHER; the game asks the treasury, it can never mint.');

INSERT INTO goals (title, detail, status, priority, progress, realm) VALUES
    ('Bring the city online', 'Deploy the Worker, set RP_SHARED_SECRET, drop the roblox/ kit into Studio — first citizen paid.', 'in_progress', 1, 0, 'gaming'),
    ('A living economy', 'Citizens both earn (paychecks, jobs) and spend (shops, rent) — treasury flow moves in both directions.', 'in_progress', 2, 0, 'gaming');
