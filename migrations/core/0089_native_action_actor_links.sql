ALTER TABLE audit_context ADD COLUMN native_start INTEGER NOT NULL DEFAULT 0;
CREATE TABLE spool_native_audit_actors (
 audit_id TEXT PRIMARY KEY, project TEXT, kind TEXT NOT NULL CHECK(kind IN('agent','person')),
 actor TEXT NOT NULL CHECK(json_valid(actor)), approvers TEXT NOT NULL CHECK(json_valid(approvers))
);
