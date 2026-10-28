-- TEAM-001: queued team summaries retain the authority snapshot they disclose.
-- Pre-snapshot queued work fails closed; historical rows remain investigation data.
ALTER TABLE spool_team_mail ADD COLUMN projects TEXT NOT NULL DEFAULT '[]';
ALTER TABLE spool_team_mail ADD COLUMN member_version INTEGER NOT NULL DEFAULT 0;
