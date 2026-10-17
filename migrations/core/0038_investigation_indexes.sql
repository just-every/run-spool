CREATE INDEX issues_project_received ON issues(project,last_seen DESC,id DESC);
CREATE INDEX events_project_issue_received ON events(project,issue,received DESC,id DESC);
CREATE INDEX events_project_release_environment ON events(project,release,environment,issue);
