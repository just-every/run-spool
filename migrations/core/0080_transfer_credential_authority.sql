-- An ordinary owner transfer preserves each person's credential authority while
-- retiring both sessions. Keep the post-erasure immutable-credential fence, with
-- one narrow exception for a guarded transfer carrying an already-current key
-- forward exactly one operator version. No revoked/stale credential is revived.
DROP TRIGGER spool_erased_owner_credential_update;
CREATE TRIGGER spool_erased_owner_credential_update BEFORE UPDATE ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner')
 AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
 AND NOT COALESCE((
  NEW.revoked IS NOT NULL AND NEW.hash IS OLD.hash AND NEW.project IS OLD.project
  AND NEW.kind IS OLD.kind AND NEW.created IS OLD.created
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
