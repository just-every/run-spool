-- Operational notices remain excluded from archives. Existing notices keep
-- their state and never acquire a fabricated provider acknowledgment.
ALTER TABLE follow_up_notices ADD COLUMN provider TEXT CHECK(provider IS NULL OR provider='slack');
ALTER TABLE follow_up_notices ADD COLUMN message_id TEXT;
