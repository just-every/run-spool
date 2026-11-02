import { erasureLabel, erasureRank, erasureTotal } from './erasureLabels';

export function ErasureCounts({ title, counts }: { title: string; counts: Record<string, number> }) {
  const rows = Object.entries(counts).filter(([, n]) => n > 0).sort(([a], [b]) => erasureRank(a) - erasureRank(b));
  if (!rows.length) return null;
  return <><h3>{title}</h3><dl className="erasure-counts">{rows.map(([table, n]) => <div key={table}><dt>{erasureLabel(table)}</dt><dd>{n}</dd></div>)}</dl></>;
}
export const KeptOnPurpose = ({ preview }: { preview: any }) => <>
  <h3>Kept on purpose</h3>
  <ul className="erasure-kept">{preview.retained.map((item: any) => <li key={item.table}>{item.reason}</li>)}{preview.exceptions.map((text: string) => <li key={text}>{text}</li>)}</ul>
</>;
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
