-- Consent-scoped contact, raster screenshot and bounded reply ledger share the
-- report's existing custody: one row, one withdrawal/retention/erasure fence.
ALTER TABLE feedback ADD COLUMN private_data TEXT DEFAULT NULL
 CHECK(private_data IS NULL OR (json_valid(private_data) AND length(private_data)<=240000));
