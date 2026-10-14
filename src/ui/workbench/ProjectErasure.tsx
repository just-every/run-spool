import { useState } from 'react';
import { Field, type Request, type Run } from './shared';

// Owner-only project erasure (BASE-DATA-003): count-only preview, typed
// confirmation, then a receipt with counts and times. Values never appear here.
const labels: Record<string, string> = {
  projects: 'Project', events: 'Occurrences', issues: 'Issues', releases: 'Releases', artifacts: 'Source maps', outcomes: 'Admission counters',
  credentials: 'Project keys', browser_origins: 'Browser origins', browser_origin_guards: 'Origin guards', sentry_project_aliases: 'Sentry DSN aliases',
  sentry_import_targets: 'Sentry import records', alerts: 'Alert feed entries', alert_rules: 'Alert rules', alert_cursors: 'Spike cursors',
  alert_expansion_cursors: 'Alert cursors', alert_history: 'Alert history', alert_intents: 'Alert intents', alert_mail_jobs: 'Mail jobs',
  alert_mail_attempts: 'Mail attempts', rer_mail_development_outbox: 'Development outbox messages', oa_dev_credentials: 'Dev-minted key marks',
  integration_deliveries: 'Webhook deliveries', integration_attempts: 'Webhook attempts', integration_resolutions: 'Webhook resolutions',
  integration_replays: 'Webhook replays', integration_tokens: 'Integration tokens', integration_token_events: 'Integration token events',
  integration_token_usage: 'Integration token usage', repairs: 'Repairs', repair_checks: 'Repair checks', reproducers: 'Reproducers', reproducer_runs: 'Reproducer runs', reproducer_run_tokens: 'Reproducer run tokens', fix_workflows: 'Fix workflows', fix_leases: 'Fix step leases', fix_receipts: 'Fix receipts', exposures: 'Exposure reports', audit: 'Audit entries', alert_scheduler: 'Scheduler cursor',
};
const label = (table: string) => labels[table] ?? table;
const total = (counts: Record<string, number>) => Object.values(counts).reduce((sum, n) => sum + n, 0);
function Counts({ title, counts }: { title: string; counts: Record<string, number> }) {
  const order = Object.keys(labels), rank = (table: string) => order.includes(table) ? order.indexOf(table) : order.length;
  const rows = Object.entries(counts).filter(([, n]) => n > 0).sort(([a], [b]) => rank(a) - rank(b));
  if (!rows.length) return null;
  return <><h3>{title}</h3><dl className="erasure-counts">{rows.map(([table, n]) => <div key={table}><dt>{label(table)}</dt><dd>{n}</dd></div>)}</dl></>;
}
// A stable ref callback runs once, when the receipt heading mounts.
const focusOnMount = (element: HTMLElement | null) => element?.focus();
const when = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', hour12: false }) + ' UTC' : 'Not yet';

export function ProjectErasure({ project, request, run, busy }: { project: string; request: Request; run: Run; busy: boolean }) {
  const [preview, setPreview] = useState<any>(null), [typed, setTyped] = useState(''), [receipt, setReceipt] = useState<any>(null);
  if (receipt) return <section className="evidence" aria-labelledby="erasure-receipt">
    <h2 id="erasure-receipt" tabIndex={-1} ref={focusOnMount}>{receipt.phase === 'complete' ? 'Project erased' : 'Erasure continuing'}</h2>
    <p role="status">{receipt.phase === 'complete' ? `${total(receipt.deleted)} rows deleted in ${receipt.seconds} seconds.` : 'The rest continues on the next scheduled run.'}</p>
    <Counts title="Deleted" counts={receipt.deleted} />
    <h3>Times</h3>
    <dl className="erasure-counts">
     <div><dt>Requested</dt><dd>{when(receipt.requestedAt)}</dd></div>
     <div><dt>Deleted from the database</dt><dd>{when(receipt.committedAt)}</dd></div>
     <div><dt>Completed</dt><dd>{when(receipt.completedAt)}</dd></div>
    </dl>
    <h3>Kept on purpose</h3>
    <ul className="erasure-kept">{receipt.retained.map((item: any) => <li key={item.table}>{item.reason}</li>)}{receipt.exceptions.map((text: string) => <li key={text}>{text}</li>)}</ul>
    <button className="primary-button" onClick={() => window.location.assign('/')}>Continue</button>
  </section>;
  return <section className="evidence" aria-labelledby="erasure-title">
    <h2 id="erasure-title">Erase this project</h2>
    <p>Erasure permanently deletes this project and everything recorded for it: occurrences, issues, releases, source maps, keys, origins, alerts and their delivery history, repairs, reproducers, fix workflows, exposure reports and Sentry import records. It cannot be undone.</p>
    <button className="text-button" disabled={busy} onClick={() => void run(async () => { setPreview(await request(`/api/projects/${project}/erasure`)); setTyped(''); })}>Preview erasure</button>
    {preview && <>
      <p role="status">{total(preview.deleted)} rows will be deleted.</p>
      <Counts title="Will be deleted" counts={preview.deleted} />
      <Counts title="Kept without their project link" counts={preview.redacted} />
      <h3>Kept on purpose</h3>
      <ul className="erasure-kept">{preview.retained.map((item: any) => <li key={item.table}>{item.reason}</li>)}{preview.exceptions.map((text: string) => <li key={text}>{text}</li>)}</ul>
      {preview.hold ? <p role="alert">Another erasure is still running. Try again after it completes.</p> : <>
        <Field label={`Type ${project} to confirm`} value={typed} autoComplete="off" spellCheck={false} onChange={event => setTyped(event.target.value)} />
        <button className="danger-button" disabled={busy || typed !== project} onClick={() => void run(async () => {
          // The receipt heading takes focus as it mounts, so focus never passes through an empty frame.
          setReceipt(await request(`/api/projects/${project}/erasure`, 'POST', { confirm: typed, planHash: preview.planHash }));
        })}>Erase project</button>
      </>}
    </>}
  </section>;
}
