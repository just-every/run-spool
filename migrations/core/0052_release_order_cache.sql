-- Disposable derived keys must not create authoritative release metadata on reads.
CREATE TABLE release_order_keys (
 project TEXT NOT NULL,
 release TEXT NOT NULL,
 version_key TEXT,
 PRIMARY KEY(project,release),
 FOREIGN KEY(project,release) REFERENCES releases(project,name) ON DELETE CASCADE
);
