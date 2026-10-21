-- SRC-003: the staging, receipt and release/deploy enrichment tables behind the Sentry-compatible
-- CLI and build-plugin routes (/api/0). Additive: no existing row or table changes. No foreign
-- keys, as in 0059: an import undo removes its own projects, and these rows follow by declaration.
--
-- Chunks and assembly receipts are transient staging for one upload. They are never exported and
-- are erased with their project. Chunk data (base64) expires an hour after receipt and on assembly.
CREATE TABLE sentry_upload_chunks (
 project TEXT NOT NULL,
 sha1 TEXT NOT NULL CHECK(length(sha1)=40),
 size INTEGER NOT NULL CHECK(size>=0),
 data TEXT NOT NULL,
 created INTEGER NOT NULL,
 PRIMARY KEY(project,sha1)
);
CREATE INDEX sentry_upload_chunks_created ON sentry_upload_chunks(created);
CREATE TABLE sentry_assemblies (
 project TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('artifact_bundle')),
 checksum TEXT NOT NULL CHECK(length(checksum)=40),
 state TEXT NOT NULL CHECK(state IN ('ok','error')),
 detail TEXT,
 created INTEGER NOT NULL,
 PRIMARY KEY(project,kind,checksum)
);
-- What an unmodified sentry-cli or build plugin registered for a release: the finalization time
-- and URL it sent. The release itself, its first-seen time and its commits stay in the
-- existing release and commit tables (SDK-009, TEAM-004), so one release keeps one identity.
CREATE TABLE sentry_releases (
 project TEXT NOT NULL,
 release TEXT NOT NULL,
 url TEXT CHECK(url IS NULL OR length(url)<=2048),
 started INTEGER,
 released INTEGER,
 created INTEGER NOT NULL,
 PRIMARY KEY(project,release)
);
-- Deploys reported by `sentry-cli releases deploys new`. They carry no commit range, deadline or
-- notification destination, so they stay separate from REL-001 deployment runs and claim none.
CREATE TABLE sentry_deploys (
 project TEXT NOT NULL,
 id TEXT NOT NULL,
 release TEXT NOT NULL,
 environment TEXT NOT NULL CHECK(length(environment)>=1 AND length(environment)<=64),
 name TEXT CHECK(name IS NULL OR length(name)<=64),
 url TEXT CHECK(url IS NULL OR length(url)<=2048),
 started INTEGER,
 finished INTEGER,
 actor TEXT NOT NULL,
 created INTEGER NOT NULL,
 PRIMARY KEY(project,id)
);
CREATE INDEX sentry_deploys_release ON sentry_deploys(project,release,created);
