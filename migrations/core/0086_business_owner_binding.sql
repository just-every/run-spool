-- Freeze the signed Business owner's native identity. Native ownership transfer
-- and address reuse must never transfer a Business token's sponsorship.
CREATE TABLE spool_business_owner_binding (business_id TEXT PRIMARY KEY, native_id TEXT NOT NULL UNIQUE);
