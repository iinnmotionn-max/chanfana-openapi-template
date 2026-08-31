-- Migration number: 0026
-- THE NEWSROOM — posts that come from something that actually happened.
--
-- Content drafting used four fixed templates with a topic word swapped in. Run
-- that hourly and you get the same four posts forever: confident, specific-
-- sounding, and saying nothing. Nobody would follow that account, and worse,
-- nobody should — it is a feed with no information in it.
--
-- Meanwhile this system generates real material every single hour. It closes
-- trades, breeds a new strategy generation, retires a strategy for losing
-- money, scores its own security, catches structural drift, completes quests,
-- pays citizens in a Roblox city. That is a build-in-public feed already; it
-- just was not being read.
--
-- event_key is what stops the same thing being posted twice. It is derived
-- from the event itself ("evolution:g3", "retired:mean reversion") so the same
-- fact can never be drafted again, however many pulses run.

ALTER TABLE posts ADD COLUMN event_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_posts_event ON posts(event_key);
