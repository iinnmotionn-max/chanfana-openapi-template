-- Migration number: 0015 	 2026-07-07T07:00:00.000Z
-- GROWTH v2: posting connectors (honest publish adapter), a partnerships/deals
-- pipeline, and campaign analytics — all under the existing 'growth' realm.
-- A connector is only "live" when its API credentials are set as Worker
-- secrets; until then a "publish" is a local flag, never a claimed real post.

CREATE TABLE IF NOT EXISTS connectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    platform TEXT NOT NULL UNIQUE,
    handle TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'disconnected',
    updated_at DATETIME
);
INSERT INTO connectors (platform) VALUES ('x'), ('linkedin'), ('instagram'), ('blog');

CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    partner TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL DEFAULT 'prospect',
    value REAL NOT NULL DEFAULT 0,
    probability REAL NOT NULL DEFAULT 0.2,
    note TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);
