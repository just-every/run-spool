-- Local owner sign-in. Keep the last proof time after removal so an old
-- registration response cannot put a removed passkey back.
CREATE TABLE spool_local_owner_passkeys (
 operator_id TEXT PRIMARY KEY REFERENCES oa_operators(id) ON DELETE CASCADE,
 credential_id TEXT UNIQUE,
 public_key TEXT,
 counter INTEGER NOT NULL,
 last_proof_at INTEGER NOT NULL
);
