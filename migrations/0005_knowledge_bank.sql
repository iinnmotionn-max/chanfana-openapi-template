-- Migration number: 0005 	 2026-07-07T03:00:00.000Z
-- KNOWLEDGE BANK: what Lumi gathers from the outside world — Hugging Face
-- models/datasets, live market snapshots — stored like every other memory.

CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    source TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge(source, id);

INSERT INTO quests (title, detail, skill, xp_reward, metric, target) VALUES
    ('First expedition', 'Research the outside world: gather 5 pieces of knowledge.', 'insight', 120, 'knowledge_items', 5),
    ('Eyes on the market', 'Scout a live market snapshot from the real world.', 'engineering', 80, 'market_snapshots', 1);
