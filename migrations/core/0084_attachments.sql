-- Private attachment capture is disabled until the owner explicitly approves it.
CREATE TABLE attachment_policies(project TEXT PRIMARY KEY REFERENCES projects(id),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),revision INTEGER NOT NULL,updated INTEGER NOT NULL);
CREATE TABLE event_attachments(
 project TEXT NOT NULL REFERENCES projects(id),id TEXT NOT NULL,event TEXT NOT NULL,occurrence TEXT NOT NULL,
 name TEXT NOT NULL,type TEXT NOT NULL,content_type TEXT NOT NULL,bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 262144),
 payload TEXT NOT NULL,digest TEXT NOT NULL,created INTEGER NOT NULL,
 PRIMARY KEY(project,id),FOREIGN KEY(project,event,occurrence) REFERENCES events(project,id,occurrence) ON DELETE CASCADE
);
CREATE INDEX event_attachments_created ON event_attachments(project,created,id);
CREATE INDEX event_attachments_event ON event_attachments(project,event,occurrence);
CREATE TRIGGER attachment_capacity BEFORE INSERT ON event_attachments WHEN
 (SELECT COUNT(*) FROM event_attachments WHERE project=NEW.project)>=1000 OR
 (SELECT COALESCE(SUM(bytes),0) FROM event_attachments WHERE project=NEW.project)+NEW.bytes>16777216
 BEGIN SELECT RAISE(ABORT,'attachment_capacity'); END;
CREATE TRIGGER attachment_restore_insert BEFORE INSERT ON event_attachments WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER attachment_restore_update BEFORE UPDATE ON event_attachments WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER attachment_restore_delete BEFORE DELETE ON event_attachments WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
