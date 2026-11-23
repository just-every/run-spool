-- Ordered covering lookups for the primary short ID and issue aliases.
CREATE INDEX IF NOT EXISTS issue_short_ids_assigned_number ON issue_short_ids(project,assigned,number,issue,short_id);
CREATE INDEX IF NOT EXISTS issue_short_ids_issue_number ON issue_short_ids(project,issue,number,assigned,short_id);

-- Attention reads stop at the newest active alert for each issue.
CREATE INDEX IF NOT EXISTS alerts_issue_attention ON alerts(
  project,issue,created DESC,COALESCE(json_extract(payload,'$.release.sequence'),0) DESC,id DESC
) WHERE kind IN ('new_issue','regression');

CREATE INDEX IF NOT EXISTS events_project_issue_release ON events(project,issue,release);
CREATE INDEX IF NOT EXISTS events_project_environment_received ON events(project,environment,received,issue);
