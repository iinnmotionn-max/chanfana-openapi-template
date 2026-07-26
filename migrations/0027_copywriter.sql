-- Migration number: 0027
-- WHO WROTE IT.
--
-- Posts can now be written by Claude from the same recorded facts, or by the
-- built-in template when Claude is unlinked, unreachable, or when its draft is
-- REJECTED for containing a figure with no source. All three are normal, and
-- which one happened must never be a guess: a feed that claims every number
-- comes from a row has to be able to show which writer produced each row, and
-- why a draft fell back.

ALTER TABLE posts ADD COLUMN writer TEXT NOT NULL DEFAULT 'template';
ALTER TABLE posts ADD COLUMN writer_note TEXT NOT NULL DEFAULT '';
