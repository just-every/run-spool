import { useEffect, useRef, useState } from 'react';
import { Details } from './workbench/Details';
import { useDraft, type Request, type Run } from './workbench/shared';
export function BrowserOrigins({ project, busy, request, run }: { project: string; busy: boolean; request: Request; run: Run }) {
  const [rows, setRows] = useState<any[] | null>(null), [origin, setOrigin] = useDraft(`${project}.browser-origin`, '');
  const [error, setError] = useState(''), [fieldError, setFieldError] = useState(''), [result, setResult] = useState(''), [reload, setReload] = useState(0), [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null), removed = useRef<string | null>(null);
  useEffect(() => {
    let alive = true; setLoading(true); setError('');
    request(`/api/projects/${project}/browser-origins`).then(next => {
      if (!alive) return; setRows(next); setLoading(false);
      if (removed.current && !next.some((row: any) => row.origin === removed.current)) { removed.current = null; requestAnimationFrame(() => input.current?.focus()); }
    }).catch(failure => { if (alive) { setLoading(false); setRows(null); setError(failure.message); } });
    return () => { alive = false; };
  }, [project, reload, request]);
  async function change(value: string, method: string) {
    const response = await request(`/api/projects/${project}/browser-origins`, method, { origin: value });
    setResult(response.implicit ? `${response.origin} is this service’s own origin and remains allowed.` : response.changed ? `${method === 'POST' ? 'Allowed' : 'Removed'} ${response.origin}` : `${response.origin} was already ${method === 'POST' ? 'allowed' : 'absent'}.`);
    if (method === 'POST') setOrigin(''); else removed.current = value;
    setReload(value => value + 1);
  }
  return <section className="evidence" aria-labelledby="browser-origins-heading"><h2 id="browser-origins-heading">2. Allow your application’s origin</h2><p>Enter the origin where your application runs, including its port when needed. Each event also needs this project’s capture key.</p>
    <form className="form-grid" onSubmit={event => { event.preventDefault(); setFieldError(''); void run(async () => { try { await change(origin, 'POST'); } catch (failure) { setFieldError((failure as Error).message); } }); }}><label className="form-field">Exact application origin<input ref={input} type="url" disabled={busy || loading} required maxLength={1024} placeholder="https://app.example" value={origin} aria-invalid={!!fieldError} aria-describedby="browser-origin-help" onChange={event => { setOrigin(event.target.value); setFieldError(''); }} /></label><button className="primary-button" disabled={busy || loading || !origin}>Allow browser origin</button></form>
    <p id="browser-origin-help" className={fieldError ? 'field-error' : 'muted'} role={fieldError ? 'alert' : undefined}>{fieldError || 'Use scheme, host and port only, without a trailing slash or path.'}</p>
    {loading ? <p role="status">Loading browser origins…</p> : error ? <><p role="alert">Browser origins unavailable: {error}</p><button className="text-button" onClick={() => setReload(value => value + 1)}>Refresh origins</button></> : rows?.length ? rows.map(row => <div className="data-row" key={row.origin}><code>{row.origin}</code><button className="text-button" aria-label={`Remove browser origin ${row.origin}`} disabled={busy} onClick={() => void run(() => change(row.origin, 'DELETE'))}>Remove</button></div>) : <p>No other browser origins allowed.</p>}
    {result && <p role="status">{result}</p>}<Details title="Browser capture access" triggerLabel="About browser capture"><p>Scheme, host and port must match. Wildcards, credentials, paths, queries and fragments are refused. Up to 20 other origins are allowed; Spool’s own origin is implicitly allowed.</p><p>This grants capture access only, never private reading or owner authority. Server callers with no Origin header still require an active project key. Browser-visible keys can be copied, and server callers can forge Origin. CSP, mixed-content restrictions and network failures still apply.</p><p>Removing an origin blocks later events from that origin. Previously stored evidence remains.</p></Details>
  </section>;
}
