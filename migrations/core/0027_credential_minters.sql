-- Agent and deploy keys are fenced with the person whose session minted them:
-- each records that person and their identity fence (oa_operators.version) at
-- minting, and counts only while that person is active at that same version. A
-- fence from the linked Auth install or a suspension moves the version, so the
-- keys never count again. Spool's API mints only from the owner's session, so
-- keys minted before this record the current owner.
ALTER TABLE credentials ADD COLUMN minted_by TEXT;
ALTER TABLE credentials ADD COLUMN minted_version INTEGER;
UPDATE credentials SET minted_by=(SELECT id FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1),
 minted_version=(SELECT version FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1)
 WHERE kind IN ('agent','deploy');
