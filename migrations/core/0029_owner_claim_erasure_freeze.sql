-- Owner-erasure write freeze (see 0028) for the managed claim ledger from
-- 0011_owner_claim, kept separate so 0028 does not depend on that ledger.
CREATE TRIGGER spool_owner_erasure_oc_owner_claims_insert BEFORE INSERT ON oc_owner_claims
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
CREATE TRIGGER spool_owner_erasure_oc_owner_claims_update BEFORE UPDATE ON oc_owner_claims
WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase<>'complete') AND NOT EXISTS(SELECT 1 FROM rer_erasure_guard)
BEGIN SELECT RAISE(ABORT,'owner_erasure_in_progress'); END;
