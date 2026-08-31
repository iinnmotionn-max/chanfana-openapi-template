-- Migration number: 0014 	 2026-07-07T09:00:00.000Z
-- GROWTH: PR, content, and lead-gen. Lumi drafts marketing copy the creator
-- reviews, groups posts into campaigns, and hunts opportunities. Honesty first:
-- posts are DRAFTS — "publishing" flips a local status flag only; no real
-- account is connected, so nothing is actually posted to X/LinkedIn/etc. Lead
-- scouting is curated and offline-safe: no live external search, no ad spend.

INSERT INTO realms (key, title, mission) VALUES
    ('growth', 'Growth', 'PR, content, and lead-gen: draft posts, run campaigns, and hunt opportunities.');

-- A campaign groups a batch of posts around one goal.
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Draft social/content posts. status is a LOCAL flag only — 'published' means
-- the creator marked it ready, not that it went to a real network.
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    campaign_id INTEGER,
    platform TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'post',
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    media_prompt TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leads / opportunities in the pipeline. Scouted leads are curated & offline.
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new',
    value REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO goals (title, detail, status, priority, progress, realm) VALUES
    ('First campaign', 'Draft a campaign and three posts, and log three leads.', 'in_progress', 2, 0, 'growth');
