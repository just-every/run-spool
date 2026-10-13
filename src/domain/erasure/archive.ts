// Archive custody for BASE-DATA-003 project erasure. Completed receipts travel
// (counts and times only); the helper's work tables never do. Audit entries of
// an erased project travel only in their anonymised form.
export const erasureArchiveTables = ['rer_erasure_operations'];
export const erasureExcludedTables = ['rer_erasure_blobs', 'rer_erasure_guard', 'rer_erasure_scope'];

const label = /^\{"erasure":"(pending|erased:[0-9a-f]{32})"\}$/;
const counts = (value: string) => { const parsed = JSON.parse(value); return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.entries(parsed).every(([table, n]) => /^[a-z_][a-z0-9_]{0,127}$/.test(table) && Number.isSafeInteger(n) && (n as number) >= 0); };
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function assert(ok: unknown, code: string): asserts ok { if (!ok) throw new Error(code); }

export const erasedAudit = (row: any) => row.project === null && typeof row.detail === 'string' && label.test(row.detail);

/** Validates receipts and anonymised audit rows, then hands the rest to the existing validators. */
export function validateErasureArchive(data: Record<string, any[]>) {
 for (const row of data.rer_erasure_operations ?? []) {
  // An archive made while an erasure was still deleting would carry its subject.
  assert(row.entity === 'project' && row.subject === null && row.phase === 'complete', 'Archive erasure in progress');
  assert(/^[0-9a-f]{32}$/.test(row.id) && /^erased:[0-9a-f]{32}$/.test(row.label) && counts(row.planned) && counts(row.deleted), 'Archive erasure receipt');
  assert(Number.isSafeInteger(row.step) && Number.isSafeInteger(row.blobs_total) && Number.isSafeInteger(row.blobs_deleted) && time(row.requested_at) && time(row.committed_at) && time(row.completed_at), 'Archive erasure receipt');
  const retained = JSON.parse(row.retained);
  assert(Array.isArray(retained) && retained.every((item: any) => item && Object.keys(item).sort().join() === 'reason,table' && typeof item.table === 'string' && typeof item.reason === 'string'), 'Archive erasure receipt');
 }
 for (const row of data.audit.filter(erasedAudit)) assert(/^[a-z_]{1,64}$/.test(row.kind) && Number.isSafeInteger(row.created), 'Archive erased audit');
 const { rer_erasure_operations: _receipts, ...rest } = data;
 return { ...rest, audit: data.audit.filter(row => !erasedAudit(row)) };
}
