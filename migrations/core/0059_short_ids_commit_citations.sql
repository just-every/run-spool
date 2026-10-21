-- TEAM-004: stable per-project issue short IDs kept as aliases through merge and
-- split, and the commits a deploy key registers with their citations, link log and
-- resolution. Additive: no existing row or table changes. No foreign keys: an import
-- undo removes its own projects and issues, and these rows follow by declaration.
CREATE TABLE short_id_prefixes (
 prefix TEXT PRIMARY KEY,
 project TEXT NOT NULL UNIQUE,
 next INTEGER NOT NULL CHECK(next>=1),
 created INTEGER NOT NULL
);
CREATE TABLE issue_short_ids (
 short_id TEXT PRIMARY KEY,
 project TEXT NOT NULL,
 issue TEXT NOT NULL,
 assigned TEXT NOT NULL,
 number INTEGER NOT NULL CHECK(number>=1),
 created INTEGER NOT NULL,
 UNIQUE(project,number)
);
CREATE INDEX issue_short_ids_issue ON issue_short_ids(project,issue);
CREATE INDEX issue_short_ids_assigned ON issue_short_ids(project,assigned);
CREATE TABLE issue_short_id_moves (
 project TEXT NOT NULL,
 correction TEXT NOT NULL,
 short_id TEXT NOT NULL,
 direction TEXT NOT NULL CHECK(direction IN ('apply','undo')),
 from_issue TEXT NOT NULL,
 to_issue TEXT NOT NULL,
 created INTEGER NOT NULL,
 PRIMARY KEY(correction,short_id,direction)
);
-- Author and message are personal data: retention, project and owner erasure cover them.
CREATE TABLE commits (
 project TEXT NOT NULL,
 sha TEXT NOT NULL CHECK(length(sha) IN (40,64)),
 message TEXT CHECK(message IS NULL OR length(message)<=8192),
 author_name TEXT CHECK(author_name IS NULL OR length(author_name)<=200),
 author_email TEXT CHECK(author_email IS NULL OR length(author_email)<=320),
 received INTEGER NOT NULL,
 expired INTEGER,
 PRIMARY KEY(project,sha)
);
CREATE TABLE release_commits (
 project TEXT NOT NULL,
 release TEXT NOT NULL,
 sha TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('release','deployment','sha_release')),
 created INTEGER NOT NULL,
 PRIMARY KEY(project,release,sha)
);
CREATE INDEX release_commits_sha ON release_commits(project,sha);
CREATE TABLE commit_links (
 project TEXT NOT NULL,
 sha TEXT NOT NULL,
 issue TEXT NOT NULL,
 citation TEXT NOT NULL,
 short_id TEXT NOT NULL,
 linked INTEGER NOT NULL,
 release TEXT,
 resolved INTEGER,
 pr TEXT,
 token TEXT,
 PRIMARY KEY(project,sha,issue)
);
CREATE INDEX commit_links_issue ON commit_links(project,issue);
CREATE TABLE repository_link_log (
 project TEXT NOT NULL,
 sha TEXT NOT NULL,
 citation TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('unknown','other_project','inaccessible')),
 created INTEGER NOT NULL,
 PRIMARY KEY(project,sha,citation)
);
CREATE TABLE commit_sharing (
 project TEXT PRIMARY KEY,
 share INTEGER NOT NULL CHECK(share IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision>=1),
 updated INTEGER NOT NULL
);
-- Existing projects take their prefix in creation order and existing issues their
-- number in first-seen order, exactly as src/domain/short-ids/assign.ts numbers the
-- issues of an older archive on restore.
INSERT INTO short_id_prefixes(prefix,project,next,created)
 SELECT CASE WHEN position=1 THEN base ELSE base||'_'||position END,id,1,created FROM (
  SELECT id,created,base,ROW_NUMBER() OVER (PARTITION BY base ORDER BY created,id) position FROM (
   SELECT id,created,COALESCE(NULLIF(trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(upper(id),'.','-'),':','-'),'_','-'),'--','-'),'--','-'),'--','-'),'--','-'),'--','-'),'--','-'),'--','-'),'-'),''),'P') base FROM projects));
INSERT INTO issue_short_ids(short_id,project,issue,assigned,number,created)
 SELECT p.prefix||'-'||(CASE WHEN (m.n)>=1073741824 THEN substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',((m.n)/1073741824)%32+1,1) ELSE '' END||CASE WHEN (m.n)>=33554432 THEN substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',((m.n)/33554432)%32+1,1) ELSE '' END||CASE WHEN (m.n)>=1048576 THEN substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',((m.n)/1048576)%32+1,1) ELSE '' END||CASE WHEN (m.n)>=32768 THEN substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',((m.n)/32768)%32+1,1) ELSE '' END||CASE WHEN (m.n)>=1024 THEN substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',((m.n)/1024)%32+1,1) ELSE '' END||CASE WHEN (m.n)>=32 THEN substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',((m.n)/32)%32+1,1) ELSE '' END||substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ',(m.n)%32+1,1)),m.project,m.id,m.id,m.n,m.first_seen
 FROM (SELECT id,project,first_seen,ROW_NUMBER() OVER (PARTITION BY project ORDER BY first_seen,id) n FROM issues) m JOIN short_id_prefixes p ON p.project=m.project;
UPDATE short_id_prefixes SET next=COALESCE((SELECT MAX(number) FROM issue_short_ids WHERE project=short_id_prefixes.project),0)+1;
