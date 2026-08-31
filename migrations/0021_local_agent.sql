-- Migration number: 0021
-- LOCAL AGENT — the bridge to the creator's own machine.
--
-- The Worker cannot touch a filesystem or shell. So Lumi queues a task here,
-- and a small agent the creator runs ON THEIR OWN MACHINE polls for it,
-- decides whether to run it, and posts the result back. The machine always
-- holds the veto: nothing executes that the local agent didn't accept.

CREATE TABLE IF NOT EXISTS local_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    task TEXT NOT NULL,                    -- what Lumi is asking the machine to do
    status TEXT NOT NULL DEFAULT 'queued', -- queued | claimed | done | failed | refused
    result TEXT NOT NULL DEFAULT '',
    host TEXT NOT NULL DEFAULT '',         -- which machine claimed it
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_local_queued ON local_tasks(status, id);

-- Reaching the creator's machine is its own authority scope, revoked by
-- default like every other power that leaves the sandbox.
INSERT INTO authority (scope, granted, detail) VALUES
    ('machine', 0, 'Queue work for the agent on the creator''s own computer. Off until granted; the local agent still approves each task.');
