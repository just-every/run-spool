-- Public per-key loader configuration, never the raw ingest key. Existing keys
-- have no row and read conservative defaults; no existing row is rewritten.
-- Settings restore as inert configuration: archives never restore credentials.
CREATE TABLE loader_settings (
 project TEXT NOT NULL,
 key_hash TEXT NOT NULL CHECK(length(key_hash)=64),
 revision INTEGER NOT NULL CHECK(revision>=1),
 settings TEXT NOT NULL CHECK(json_valid(settings)),
 updated INTEGER NOT NULL,
 PRIMARY KEY(project,key_hash)
);
