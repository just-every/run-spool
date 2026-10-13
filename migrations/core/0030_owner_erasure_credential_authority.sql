-- Durable credential authority after any owner erasure (0028 freezes writes only
-- while the operation runs). An earlier release created these triggers at request
-- time when the first erasure began; replace them here.
-- A new credential must name the active owner at the identity fence it was
-- minted under, so a predecessor mint admitted before the handoff and resumed
-- after it is refused. An existing credential may afterwards only be revoked:
-- revocation never depends on who minted the key or on a later identity fence.
-- The erasure's own guarded batch clears the erased owner's ingest-key attribution.
DROP TRIGGER IF EXISTS spool_erased_owner_credential_insert;
DROP TRIGGER IF EXISTS spool_erased_owner_credential_update;
CREATE TRIGGER spool_erased_owner_credential_insert BEFORE INSERT ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner')
 AND NOT EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=NEW.minted_by AND o.version=NEW.minted_version AND o.status='active' AND o.role='owner')
BEGIN SELECT RAISE(ABORT,'credential_authority_changed'); END;
CREATE TRIGGER spool_erased_owner_credential_update BEFORE UPDATE ON credentials
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
 AND (NEW.revoked IS NULL OR NEW.hash IS NOT OLD.hash OR NEW.project IS NOT OLD.project OR NEW.kind IS NOT OLD.kind OR NEW.created IS NOT OLD.created
  OR NEW.minted_by IS NOT OLD.minted_by OR NEW.minted_version IS NOT OLD.minted_version)
BEGIN SELECT RAISE(ABORT,'credential_authority_changed'); END;
