-- REL-002: owner judgments on labelled release/commit correlations. No occurrence changes.
CREATE TABLE suspect_decisions (
 project TEXT NOT NULL,
 issue TEXT NOT NULL,
 release TEXT NOT NULL,
 sha TEXT NOT NULL,
 judgment TEXT NOT NULL CHECK(judgment IN ('confirmed','rejected')),
 note TEXT NOT NULL CHECK(length(note) BETWEEN 1 AND 600),
 revision INTEGER NOT NULL CHECK(revision>=1),
 updated INTEGER NOT NULL,
 operator_id TEXT NOT NULL,
 PRIMARY KEY(project,issue,release,sha)
);
CREATE INDEX suspect_decisions_owner ON suspect_decisions(operator_id);
