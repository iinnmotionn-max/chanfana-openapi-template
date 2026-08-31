-- Migration number: 0019
-- ORCHESTRATOR — Lumi commands every intelligence in the colony (Jarvis-style).
-- Each dispatch (to an internal agent or an external model) is logged here so
-- the cockpit shows a live task feed: who was tasked, with what, what came back.

CREATE TABLE IF NOT EXISTS orchestrator_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    target TEXT NOT NULL,              -- 'reg', 'observer', 'guardian', ..., 'claude'
    kind TEXT NOT NULL,                -- 'agent' (internal) | 'model' (external LLM)
    directive TEXT NOT NULL,           -- what Lumi asked for
    status TEXT NOT NULL DEFAULT 'done',  -- 'done' | 'failed' | 'offline'
    result TEXT NOT NULL DEFAULT '',   -- summary of what happened
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orch_tasks ON orchestrator_tasks(id DESC);
