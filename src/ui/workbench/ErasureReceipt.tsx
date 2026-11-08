import { erasureLabel, erasureRank, erasureTotal } from './erasureLabels';

export function ErasureCounts({ title, counts }: { title: string; counts: Record<string, number> }) {
  const rows = Object.entries(counts).filter(([, n]) => n > 0).sort(([a], [b]) => erasureRank(a) - erasureRank(b));
  if (!rows.length) return null;
  return <><h3>{title}</h3><dl className="erasure-counts">{rows.map(([table, n]) => <div key={table}><dt>{erasureLabel(table)}</dt><dd>{n}</dd></div>)}</dl></>;
}
const keptReason = (item: { table: string; reason: string }) => {
  if (item.table.startsWith('agent_door_')) return 'Agent action records stay with this project’s private content removed. They cannot run actions or approve future work.';
  return ({
    spool_audit_events: 'Action history stays, without links to the erased project or its people.',
    oa_operators: 'Your installation owner account stays.',
    oa_bootstrap: 'The record that this installation already has an owner stays.',
    oc_owner_claims: 'The record that this installation already has an owner stays.',
    rer_erasure_operations: 'Erasure receipts keep only counts and times.',
    ik_door_settings: 'Your Business import setting stays.',
    ik_door_revoked_keys: 'Revoked Business signing keys stay revoked.',
    ik_door_grants: 'Used Business permissions stay recorded to prevent reuse. Their imported content is removed.'
  } as Record<string, string>)[item.table] ?? item.reason;
};
export function KeptOnPurpose({ preview }: { preview: any }) {
  const explanations = [...new Set<string>([
    ...preview.retained.map(keptReason),
    ...preview.exceptions.map((text: string) => text.includes('Already downloaded archives')
      ? 'Copies outside this installation stay, including downloaded archives, delivered messages, provider records and database backups. External destination secrets are also unchanged.'
      : text.includes('one-way fingerprint') ? 'A private record of deleted data prevents an older archive from restoring it here.'
      : text.includes('brand-new installation') ? 'A new installation needs a newer archive containing the erasure record to recognise this deletion.'
      : text.includes('Other projects stay') ? 'Other projects stay.' : text)
  ])];
  return <><h3>Kept on purpose</h3><ul className="erasure-kept">{explanations.map(text => <li key={text}>{text}</li>)}</ul></>;
}
// A stable ref callback runs once, when the receipt heading mounts.
const focusOnMount = (element: HTMLElement | null) => element?.focus();
const when = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC' : 'Not yet';

export function ErasureReceipt({ receipt, progressError, onContinue }: { receipt: any; progressError?: string; onContinue: () => void }) {
  return <section className="evidence" aria-labelledby="erasure-receipt">
    <h2 id="erasure-receipt" tabIndex={-1} ref={focusOnMount} aria-live="polite">{receipt.phase === 'complete' ? 'Project erased' : 'Erasure continuing'}</h2>
    <p role="status">{receipt.phase === 'complete' ? `${erasureTotal(receipt.deleted)} rows deleted in ${receipt.seconds} seconds.` : 'Erasure is in progress. This page follows each step; it also continues in the background if you leave.'}</p>
    {progressError && <p role="alert">{progressError} The erasure remains saved for the scheduled run.</p>}
    <ErasureCounts title="Deleted" counts={receipt.deleted} />
    <h3>Times</h3>
    <dl className="erasure-counts">
     <div><dt>Requested</dt><dd>{when(receipt.requestedAt)}</dd></div>
     <div><dt>Deleted from the database</dt><dd>{when(receipt.committedAt)}</dd></div>
     <div><dt>Completed</dt><dd>{when(receipt.completedAt)}</dd></div>
    </dl>
    <KeptOnPurpose preview={receipt} />
    {(receipt.phase === 'complete' || progressError) && <button className="primary-button" onClick={onContinue}>Continue</button>}
  </section>;
}
