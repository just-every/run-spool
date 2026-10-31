-- Per-key event quotas are installation custody, like the credentials they bind.
CREATE TABLE key_rate_limits(
 project TEXT NOT NULL REFERENCES projects(id),
 key_hash TEXT NOT NULL REFERENCES credentials(hash) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>0),
 event_limit INTEGER CHECK(event_limit IS NULL OR event_limit>0),
 period_seconds INTEGER NOT NULL CHECK(period_seconds IN (60,3600)),
 updated INTEGER NOT NULL,
 PRIMARY KEY(project,key_hash)
);
CREATE TABLE key_rate_usage(
 project TEXT NOT NULL REFERENCES projects(id),
 key_hash TEXT NOT NULL REFERENCES credentials(hash) ON DELETE CASCADE,
 minute_start INTEGER NOT NULL, minute_count INTEGER NOT NULL CHECK(minute_count>=0),
 hour_start INTEGER NOT NULL, hour_count INTEGER NOT NULL CHECK(hour_count>=0),
 PRIMARY KEY(project,key_hash)
);
CREATE TRIGGER key_event_limit_insert BEFORE INSERT ON key_rate_usage
WHEN EXISTS(SELECT 1 FROM key_rate_limits l WHERE l.project=NEW.project AND l.key_hash=NEW.key_hash AND l.event_limit IS NOT NULL
 AND CASE l.period_seconds WHEN 60 THEN NEW.minute_count ELSE NEW.hour_count END>l.event_limit)
BEGIN SELECT RAISE(ABORT,'key_rate_limited'); END;
CREATE TRIGGER key_event_limit_update BEFORE UPDATE ON key_rate_usage
WHEN EXISTS(SELECT 1 FROM key_rate_limits l WHERE l.project=NEW.project AND l.key_hash=NEW.key_hash AND l.event_limit IS NOT NULL
 AND CASE l.period_seconds WHEN 60 THEN NEW.minute_count ELSE NEW.hour_count END>l.event_limit)
BEGIN SELECT RAISE(ABORT,'key_rate_limited'); END;
