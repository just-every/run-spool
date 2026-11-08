-- The operation id is opaque; no erased project identifier or credential is retained.
CREATE TABLE spool_erasure_agents (
 operation TEXT PRIMARY KEY, principal TEXT NOT NULL CHECK(json_valid(principal)), actor TEXT NOT NULL CHECK(json_valid(actor))
);
