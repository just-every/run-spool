-- Caller-recorded changed paths and coarse session cohorts contain no source text or raw user agent.
CREATE TABLE suspect_commit_files (
 project TEXT NOT NULL, sha TEXT NOT NULL, files TEXT NOT NULL CHECK(json_valid(files)), received INTEGER NOT NULL,
 PRIMARY KEY(project,sha)
);
CREATE TABLE health_session_cohorts (
 project TEXT NOT NULL, sid TEXT NOT NULL, device TEXT NOT NULL, os TEXT NOT NULL,
 PRIMARY KEY(project,sid)
);
CREATE TRIGGER health_session_cohort_expiry AFTER DELETE ON health_sessions BEGIN
 DELETE FROM health_session_cohorts WHERE project=OLD.project AND sid=OLD.sid;
END;
