import { useEffect, useRef, useState } from 'react';
import { LocalAddressWarning } from './workbench/localEndpoint';
import { Details } from './workbench/Details';
import { useDraft, type Request, type Run } from './workbench/shared';
export function BrowserOrigins({ project, busy, request, run }: { project: string; busy: boolean; request: Request; run: Run }) {
  const [rows, setRows] = useState<any[] | null>(null), [origin, setOrigin] = useDraft(`${project}.browser-origin`, '');
  const [error, setError] = useState(''), [fieldError, setFieldError] = useState(''), [result, setResult] = useState(''), [reload, setReload] = useState(0), [loading, setLoading] = useState(true), [endpoint, setEndpoint] = useState('');
  useEffect(() => { setEndpoint(location.origin); }, []);
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
    setResult(method === 'POST' ? `Saved: ${response.origin}` : response.implicit ? `${response.origin} is Spool’s own address and remains allowed.` : `Removed ${response.origin}`);
    if (method === 'POST') setOrigin(''); else removed.current = value;
    setReload(value => value + 1);
  }
  return <section className="evidence" aria-label="Allowed websites"><h2 id="browser-origins-heading">Your website address</h2><p>Paste the address where your app runs. Spool saves the website address without the page path.</p>
    <form className="form-grid" onSubmit={event => { event.preventDefault(); setFieldError(''); void run(async () => { try { await change(origin, 'POST'); } catch (failure) { setFieldError((failure as Error).message); } }); }}><label className="form-field">Your website address<input ref={input} type="text" inputMode="url" autoComplete="url" disabled={busy || loading} required maxLength={1024} placeholder="https://desk.brightwell.example" value={origin} aria-invalid={!!fieldError} aria-describedby={fieldError ? "browser-origin-help" : undefined} onChange={event => { setOrigin(event.target.value); setFieldError(''); }} /></label><button className="primary-button" disabled={busy || loading || !origin}>Allow website</button></form>
    {fieldError && <p id="browser-origin-help" className="field-error" role="alert">{fieldError}</p>}
    {loading ? <p role="status">Loading websites…</p> : error ? <><p role="alert">Website addresses unavailable: {error}</p><button className="text-button" onClick={() => setReload(value => value + 1)}>Refresh websites</button></> : rows?.length ? rows.map(row => <div className="data-row" key={row.origin}><code>{row.origin}</code><button className="text-button" aria-label={`Remove website ${row.origin}`} disabled={busy} onClick={() => void run(() => change(row.origin, 'DELETE'))}>Remove</button></div>) : <p>No other websites allowed.</p>}
    {result && <p role="status">{result}</p>}<LocalAddressWarning endpoint={endpoint} addresses={rows?.map(row => row.origin) ?? []} /><Details title="Browser capture access"><p>Scheme, host and port must match. Page paths, queries and fragments are removed when you save. Wildcards and passwords are refused. Up to 20 other origins are allowed; Spool’s own origin is implicitly allowed.</p><p>This grants capture access only, never private reading or owner authority. Server callers with no Origin header still require an active project key. Browser-visible keys can be copied, and server callers can forge Origin. CSP, mixed-content restrictions and network failures still apply.</p><p>Removing an origin blocks later events from that origin. Previously stored evidence remains.</p></Details>
  </section>;
}
