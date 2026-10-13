import { Details } from './Details';
import { hrefFor } from './location';
export const requiresRelease = (reason: string) => ['unregistered_release_or_build', 'missing_release_register_required'].includes(reason);
export const receiptLabel = (reason: string) => ({ accepted: 'Accepted', duplicate: 'Already received', rejected: 'Rejected event', unregistered_release_or_build: 'Release or build not registered', missing_release_register_required: 'Event has no release', invalid: 'Invalid event', unauthorized: 'Invalid key', oversized: 'Event too large', rate_limited: 'Rate limited', budget: 'Storage limit reached', conflict: 'Conflicting retry', storage_failure: 'Storage unavailable' } as Record<string, string>)[reason] ?? reason.replaceAll('_', ' ');
export function CaptureReceipts({ project, outcomes }: { project: string; outcomes: any }) {
  const rows = outcomes?.rows ?? [], registration = rows.some((row: any) => requiresRelease(row.reason));
  return <><h2>Capture receipts</h2><p className="muted">Received by Spool in the last 24 hours</p>{rows.length ? <dl>{rows.map((row: any) => <div key={row.reason}><dt>{receiptLabel(row.reason)}</dt><dd>{row.count}</dd></div>)}</dl> : <p>No receipts in this window.</p>}{registration && <p>These events were rejected. <a className="inline-link" href={hrefFor(project, 'releases')}>Register the release and build</a>, then reproduce the error in your application. Registration does not recover rejected events.</p>}<Details title="Capture receipts"><pre>{JSON.stringify(outcomes, null, 2)}</pre></Details></>;
}
