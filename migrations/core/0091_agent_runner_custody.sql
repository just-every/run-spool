-- A queued sandbox job retains the originating sponsor, agent and consent.
-- It retains no browser cookie, provider secret or native run token.
CREATE TABLE spool_agent_custody (
 kind TEXT NOT NULL, id TEXT NOT NULL, project TEXT NOT NULL,
 principal TEXT NOT NULL CHECK(json_valid(principal)), actor TEXT NOT NULL CHECK(json_valid(actor)),
 PRIMARY KEY(kind,id)
);
