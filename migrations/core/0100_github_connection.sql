-- Installation secret: excluded from product archives and project erasure.
CREATE TABLE spool_github_connection (
 id INTEGER PRIMARY KEY CHECK (id=1),
 value TEXT NOT NULL,
 updated INTEGER NOT NULL
);
