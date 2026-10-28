-- TEAM-001 alert controls retain the original project/installation-owner stores.
-- Membership and team names are the sole authority for these additive records.
CREATE TABLE spool_team_digest_settings (
 organization TEXT NOT NULL REFERENCES spool_organizations(id),
 team TEXT NOT NULL, member TEXT NOT NULL REFERENCES spool_members(id),
 timezone TEXT NOT NULL, daily INTEGER NOT NULL CHECK(daily IN (0,1)),
 weekly INTEGER NOT NULL CHECK(weekly IN (0,1)), hour INTEGER NOT NULL CHECK(hour BETWEEN 0 AND 23),
 created INTEGER NOT NULL, updated INTEGER NOT NULL,
 PRIMARY KEY(organization,team,member)
);
CREATE TABLE spool_team_snoozes (
 id TEXT PRIMARY KEY, organization TEXT NOT NULL REFERENCES spool_organizations(id),
 team TEXT NOT NULL, scope TEXT NOT NULL CHECK(scope IN ('team','issue','rule')),
 target TEXT NOT NULL, until INTEGER NOT NULL, created INTEGER NOT NULL,
 creator TEXT NOT NULL REFERENCES spool_members(id), resumed_at INTEGER,
 historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1))
);
CREATE INDEX spool_team_snoozes_due ON spool_team_snoozes(historical,resumed_at,until);
CREATE TABLE spool_team_mail (
 id TEXT PRIMARY KEY, organization TEXT NOT NULL REFERENCES spool_organizations(id),
 team TEXT NOT NULL, member TEXT NOT NULL REFERENCES spool_members(id),
 kind TEXT NOT NULL CHECK(kind IN ('daily','weekly','resumption')),
 period TEXT NOT NULL, body TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued', code TEXT, created INTEGER NOT NULL,
 updated INTEGER NOT NULL, historical INTEGER NOT NULL DEFAULT 0 CHECK(historical IN (0,1)),
 UNIQUE(organization,team,member,kind,period)
);
CREATE INDEX spool_team_mail_due ON spool_team_mail(state,historical,created);
CREATE TABLE spool_follow_up_alternates (
 project TEXT PRIMARY KEY REFERENCES projects(id),
 member TEXT NOT NULL REFERENCES spool_members(id),
 revision INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL
);
