-- Installation-only credential custody. Excluded from portable archives.
CREATE TABLE spool_github_connection (
 id INTEGER PRIMARY KEY CHECK(id=1),
 envelope TEXT NOT NULL
);
