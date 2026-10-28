-- Ordinary team transfers preserve live project keys while the native role
-- changes still fence sessions. After erasure, permit only this exact binding
-- advance inside the guarded owner-transfer transaction; all other credential
-- changes remain revocation-only, apart from the erasure's own guarded batch.
DROP TRIGGER spool_erased_owner_credential_update;
CREATE TRIGGER spool_erased_owner_credential_update BEFORE UPDATE ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
 AND (NEW.revoked IS NULL OR NEW.hash IS NOT OLD.hash OR NEW.project IS NOT OLD.project OR NEW.kind IS NOT OLD.kind OR NEW.created IS NOT OLD.created
  OR NEW.minted_by IS NOT OLD.minted_by OR NEW.minted_version IS NOT OLD.minted_version)
 AND NOT (
  OLD.revoked IS NULL AND NEW.revoked IS OLD.revoked
  AND NEW.hash IS OLD.hash AND NEW.project IS OLD.project AND NEW.kind IS OLD.kind AND NEW.created IS OLD.created AND NEW.minted_by IS OLD.minted_by
  AND NEW.minted_version IS OLD.minted_version+1
  AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=OLD.minted_by AND o.version=OLD.minted_version AND o.status='active')
  AND EXISTS(SELECT 1 FROM audit_context WHERE action='member.transfer' AND actor_kind='owner' AND committed=0)
  AND EXISTS(SELECT 1 FROM spool_authority_guards WHERE ok=1)
 )
BEGIN SELECT RAISE(ABORT,'credential_authority_changed'); END;
