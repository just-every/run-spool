-- Inert agent-authored advice. Only existing owner correction/rule doors apply changes.
CREATE TABLE grouping_proposals (
 id TEXT PRIMARY KEY,
 project TEXT NOT NULL REFERENCES projects(id),
 kind TEXT NOT NULL CHECK(kind IN ('split','merge','rule')),
 state TEXT NOT NULL CHECK(state IN ('proposed','rejected','approved','applied','undone','stale')),
 actor TEXT NOT NULL CHECK(length(actor)=38 AND substr(actor,1,6)='audit:'),
 input TEXT NOT NULL CHECK(json_valid(input) AND length(CAST(input AS BLOB))<=32768),
 explanation TEXT NOT NULL CHECK(json_valid(explanation) AND length(CAST(explanation AS BLOB))<=2097152),
 revisions TEXT NOT NULL CHECK(json_valid(revisions)),
 correction TEXT,
 rule_revision INTEGER,
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
CREATE INDEX grouping_proposals_project ON grouping_proposals(project,created);
CREATE TRIGGER grouping_proposal_budget BEFORE INSERT ON grouping_proposals
WHEN (SELECT COUNT(*) FROM grouping_proposals WHERE project=NEW.project)>=50
BEGIN SELECT RAISE(ABORT,'grouping_proposal_budget'); END;
