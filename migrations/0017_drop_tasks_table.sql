-- Migration number: 0017
-- Remove the last piece of template scaffolding: the `tasks` table from
-- 0001_add_tasks_table.sql. The demo task endpoints were removed when this
-- repo became the Lumi colony; no code, test, or realm references `tasks`.
-- Forward-only DROP so both fresh and already-migrated databases converge.
DROP TABLE IF EXISTS tasks;
