-- Descriptive key metadata stays with excluded credential grants, never archives.
ALTER TABLE credentials ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE credentials ADD COLUMN last_used INTEGER;

-- Names and successful-use timestamps do not change credential authority.
-- Preserve the post-erasure revocation and guarded transfer fences while
-- allowing metadata-only writes with every authority field unchanged.
DROP TRIGGER spool_erased_owner_credential_update;
CREATE TRIGGER spool_erased_owner_credential_update BEFORE UPDATE ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner')
 AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
 AND NOT COALESCE((
  NEW.revoked IS NOT NULL AND NEW.hash IS OLD.hash AND NEW.project IS OLD.project
  AND NEW.kind IS OLD.kind AND NEW.created IS OLD.created
  AND NEW.minted_by IS OLD.minted_by AND NEW.minted_version IS OLD.minted_version
  OR NEW.hash IS OLD.hash AND NEW.project IS OLD.project AND NEW.kind IS OLD.kind
  AND NEW.created IS OLD.created AND NEW.revoked IS OLD.revoked
  AND NEW.minted_by IS OLD.minted_by AND NEW.minted_version IS OLD.minted_version
  OR OLD.revoked IS NULL AND NEW.revoked IS NULL AND NEW.hash IS OLD.hash
  AND NEW.project IS OLD.project AND NEW.kind IS OLD.kind AND NEW.created IS OLD.created
  AND NEW.minted_by IS OLD.minted_by AND NEW.minted_version=OLD.minted_version+1
  AND EXISTS(SELECT 1 FROM audit_context WHERE action='member.transfer' AND committed=0)
  AND EXISTS(SELECT 1 FROM spool_authority_guards WHERE ok=1)
  AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=OLD.minted_by
   AND o.version=OLD.minted_version AND o.status='active')
 ),0)
BEGIN SELECT RAISE(ABORT,'credential_authority_changed'); END;
