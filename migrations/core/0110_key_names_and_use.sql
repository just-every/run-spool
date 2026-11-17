-- Descriptive key metadata stays with excluded credential grants, never archives.
ALTER TABLE credentials ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE credentials ADD COLUMN last_used INTEGER;
