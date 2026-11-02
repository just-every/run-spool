-- Native repository consent is a person's act, separate from agent preparation
-- and from company-policy approvers retained by the shared door.
CREATE TABLE spool_native_approvals (
 kind TEXT NOT NULL, id TEXT NOT NULL, project TEXT NOT NULL,
 person TEXT NOT NULL, name TEXT NOT NULL, revision INTEGER NOT NULL, created INTEGER NOT NULL,
 PRIMARY KEY(kind,id,revision)
);
