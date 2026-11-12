-- Local-only custody of the existing invitation token, encrypted under the
-- installation secret. Never exported; native oa_tokens remains authoritative.
CREATE TABLE spool_local_invite_links (
 invite TEXT PRIMARY KEY REFERENCES spool_member_invites(id) ON DELETE CASCADE,
 token_id TEXT NOT NULL REFERENCES oa_tokens(id) ON DELETE CASCADE,
 issuer TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 envelope TEXT NOT NULL
);
