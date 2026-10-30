-- Responsibility is separate from authority. Only private membership links can
-- be retired; permanent facts keep random aliases and their original chronology.
CREATE TABLE issue_assignment_history (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 issue TEXT NOT NULL REFERENCES issues(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 kind TEXT NOT NULL CHECK(kind IN ('member','label','unassigned')),
 member TEXT REFERENCES spool_members(id),
 target_label TEXT,
 actor_kind TEXT NOT NULL,
 actor_label TEXT NOT NULL,
 created INTEGER NOT NULL,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1)),
 UNIQUE(issue,revision)
);
CREATE INDEX issue_assignment_history_project ON issue_assignment_history(project,issue,revision);
CREATE INDEX issue_assignment_history_member ON issue_assignment_history(member);
CREATE TRIGGER portability_issue_assignment_history_insert BEFORE INSERT ON issue_assignment_history WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_issue_assignment_history_update BEFORE UPDATE ON issue_assignment_history WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
CREATE TRIGGER portability_issue_assignment_history_delete BEFORE DELETE ON issue_assignment_history WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NOT NULL) BEGIN SELECT RAISE(ABORT,'restore_in_progress'); END;
