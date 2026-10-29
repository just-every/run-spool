-- Count next-release boundary repeats under the explicit project recurrence policy.
DROP TRIGGER issue_activity_same_release;
CREATE TRIGGER issue_activity_same_release AFTER UPDATE OF count ON issues
WHEN OLD.state='resolved' AND NEW.count>OLD.count AND EXISTS(SELECT 1 FROM audit_context WHERE action IN ('capture.native','capture.sentry','capture.otlp')) AND NOT EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL)
BEGIN
 INSERT INTO issue_activity SELECT lower(hex(randomblob(16))),NEW.project,NEW.id,'resolved_release_recurrence',
 'ingest',COALESCE((SELECT actor_label FROM audit_context),'audit:'||lower(hex(randomblob(16)))),
 json_object('release',e.release,'count',1),e.received
 FROM events e JOIN issue_resolutions r ON r.project=NEW.project AND r.issue=NEW.id
 WHERE e.rowid=(SELECT rowid FROM events WHERE project=NEW.project AND issue=NEW.id ORDER BY rowid DESC LIMIT 1)
 AND (r.mode IN ('current','next') OR r.mode='named' AND EXISTS(SELECT 1 FROM issue_recurrence_boundaries snapshot WHERE snapshot.project=NEW.project AND snapshot.issue=NEW.id AND snapshot.boundary_seq=r.boundary_seq AND snapshot.seen_at_resolution=1)) AND e.release<>'' AND e.release_seq=COALESCE(r.boundary_seq,OLD.resolved_seq)
 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence);
END;
