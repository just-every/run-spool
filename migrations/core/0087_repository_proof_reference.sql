ALTER TABLE spool_native_approvals ADD COLUMN reference TEXT;
CREATE UNIQUE INDEX spool_native_approval_reference ON spool_native_approvals(reference) WHERE reference IS NOT NULL;
