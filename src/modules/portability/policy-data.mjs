import { all, quote, insist } from './storage.mjs';

// Keep approval provenance and run references, but never transfer a live delegation.
export async function revokePolicyApprovals(db,copies) {
 if(copies.oa_policy_approvals)await db.prepare(`UPDATE ${quote(copies.oa_policy_approvals)} SET revoked_at=MAX(approved_at,CAST(strftime('%s','now') AS INTEGER)*1000) WHERE revoked_at IS NULL`).run();
}

export async function refusePolicyApprovals(db,copies) {
 if(copies.oa_policy_approvals)insist(!(await all(db,`SELECT 1 FROM ${quote(copies.oa_policy_approvals)} WHERE revoked_at IS NULL LIMIT 1`)).length,'live_policy_approval',409);
}
