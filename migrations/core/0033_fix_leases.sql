-- One provider step at a time per fix workflow. The lease is taken in the same
-- batch as the step's revision claim, and only when the workflow's receipts
-- plus the step's most receipts fit the budget, so two concurrent advances
-- cannot both contact GitHub. Leases expire and stay out of archives.
CREATE TABLE fix_leases(workflow TEXT PRIMARY KEY REFERENCES fix_workflows(id) ON DELETE CASCADE,project TEXT NOT NULL REFERENCES projects(id),until INTEGER NOT NULL);
