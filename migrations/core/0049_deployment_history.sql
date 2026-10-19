CREATE TABLE deployment_actors (project TEXT NOT NULL, authority TEXT NOT NULL, label TEXT NOT NULL UNIQUE, PRIMARY KEY(project,authority));
CREATE TABLE deployment_runs (
 project TEXT NOT NULL REFERENCES projects(id), id TEXT NOT NULL, release TEXT NOT NULL,
 build TEXT NOT NULL, environment TEXT NOT NULL, repository TEXT NOT NULL, commit_sha TEXT NOT NULL,
 previous_commit TEXT, included_commits TEXT NOT NULL, started_at INTEGER NOT NULL, deadline INTEGER NOT NULL,
 destination TEXT NOT NULL, actor TEXT NOT NULL, created INTEGER NOT NULL, historical INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(project,id), FOREIGN KEY(project,release) REFERENCES releases(project,name)
);
CREATE TABLE deployment_steps (
 project TEXT NOT NULL, deployment TEXT NOT NULL, callback TEXT NOT NULL, sequence INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('started','progress','succeeded','failed','timed_out','rolled_back')),
 exposure INTEGER NOT NULL CHECK(exposure BETWEEN 0 AND 100), rollback_release TEXT,
 occurred INTEGER NOT NULL, recorded INTEGER NOT NULL, actor TEXT NOT NULL, digest TEXT NOT NULL,
 PRIMARY KEY(project,deployment,callback), UNIQUE(project,deployment,sequence),
 FOREIGN KEY(project,deployment) REFERENCES deployment_runs(project,id)
);
CREATE TABLE deployment_notices (
 project TEXT NOT NULL, deployment TEXT NOT NULL, state TEXT NOT NULL,
 created INTEGER NOT NULL, updated INTEGER NOT NULL,
 PRIMARY KEY(project,deployment), FOREIGN KEY(project,deployment) REFERENCES deployment_runs(project,id)
);
CREATE INDEX deployment_due ON deployment_runs(historical,deadline,project,id);
