CREATE TABLE scrubbing_policies (id TEXT PRIMARY KEY, project TEXT, revision INTEGER NOT NULL CHECK(revision>0), policy TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE UNIQUE INDEX scrubbing_project_policy ON scrubbing_policies(project) WHERE project IS NOT NULL;
CREATE TABLE scrubbing_previews (id TEXT PRIMARY KEY, project TEXT, scope TEXT NOT NULL, revision INTEGER NOT NULL, installation_revision INTEGER NOT NULL, digest TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE scrubbing_changes (id TEXT PRIMARY KEY, project TEXT, scope TEXT NOT NULL, revision INTEGER NOT NULL, detail TEXT NOT NULL, created INTEGER NOT NULL);
