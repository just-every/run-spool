-- Text-only Sentry feedback. Unknown event references deliberately remain
-- unattached; an exact occurrence prevents event-ID reuse from reattaching it.
CREATE TABLE feedback (
 project TEXT NOT NULL REFERENCES projects(id),
 id TEXT NOT NULL,
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 1000),
 digest TEXT NOT NULL,
 received INTEGER NOT NULL CHECK(received>=0),
 event_id TEXT,
 occurrence TEXT,
 PRIMARY KEY(project,id),
 FOREIGN KEY(project,event_id,occurrence) REFERENCES events(project,id,occurrence) ON DELETE CASCADE,
 CHECK(occurrence IS NULL OR event_id IS NOT NULL)
);
CREATE INDEX feedback_received ON feedback(project,received,id);
CREATE TRIGGER feedback_capacity BEFORE INSERT ON feedback WHEN NOT EXISTS(SELECT 1 FROM feedback WHERE project=NEW.project AND id=NEW.id) AND (SELECT COUNT(*) FROM feedback WHERE project=NEW.project)>=1000 BEGIN SELECT RAISE(ABORT,'feedback_budget'); END;
CREATE TRIGGER feedback_minute_capacity BEFORE INSERT ON feedback WHEN NOT EXISTS(SELECT 1 FROM feedback WHERE project=NEW.project AND id=NEW.id) AND (SELECT COUNT(*) FROM feedback WHERE project=NEW.project AND received>=CAST(NEW.received/60000 AS INTEGER)*60000)>=60 BEGIN SELECT RAISE(ABORT,'feedback_rate_limited'); END;
CREATE TRIGGER portability_feedback_insert BEFORE INSERT ON feedback WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_feedback_update BEFORE UPDATE ON feedback WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_feedback_delete BEFORE DELETE ON feedback WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
