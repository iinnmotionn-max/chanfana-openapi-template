-- Migration number: 0025
-- AUTOMATION RUNS — proof that the unattended work actually happened.
--
-- Lumi's automation is a Cron Trigger firing hourly into the Worker. The
-- failure mode nobody notices: it stops. A cron that silently stopped looks
-- exactly like a healthy one — the cockpit keeps rendering the last numbers it
-- has, every panel still says "nominal", and nothing anywhere says "these are
-- from Tuesday". Automation you cannot verify is automation you cannot trust,
-- and trusting it is the entire point of running it unattended.
--
-- So every unattended run records itself: what ran, what fired it, whether it
-- worked, and how long it took. From that, a gap is measurable — and a gap is
-- the only evidence that the thing which is supposed to happen on its own has
-- stopped happening on its own.

CREATE TABLE IF NOT EXISTS automation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    kind TEXT NOT NULL,            -- pulse | integrity
    source TEXT NOT NULL,          -- cron | manual | autopilot
    ok INTEGER NOT NULL DEFAULT 1,
    detail TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_automation_kind ON automation_runs(kind, id);
CREATE INDEX IF NOT EXISTS idx_automation_source ON automation_runs(source, id);
