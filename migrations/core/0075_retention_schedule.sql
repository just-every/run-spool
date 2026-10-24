-- Local execution cursor; never exported as project data.
CREATE TABLE retention_runs(
 project TEXT NOT NULL UNIQUE,generation TEXT NOT NULL,last_day INTEGER,last_run INTEGER,
 lease_until INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL CHECK(status IN('running','pending','complete','failed')),
 remaining INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project,generation)
);
