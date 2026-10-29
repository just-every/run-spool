import { useEffect, useState } from 'react';
import { Field, type Request, type Run } from './shared';
import { SectionHead } from './SectionHead';

type Connection = { slug: string; host: string; enabled: boolean; url: string };
export function CheckInRoutes({ project, request, run, busy }: { project: string; request: Request; run: Run; busy: boolean }) {
 const [snapshot, setSnapshot] = useState<{ connections: Connection[]; limit: number; egress: boolean } | null>(null);
 const [slug, setSlug] = useState(''), [url, setUrl] = useState(''), [saved, setSaved] = useState('');
 const path = `/api/projects/${project}/check-in-routes`, item = (name: string) => `${path}/${encodeURIComponent(name)}`;
 useEffect(() => { void run(async () => setSnapshot(await request(path))); }, [path]);
 if (!snapshot) return <p>Loading cron check-in connections…</p>;
 const change = (message: string, work: () => Promise<any>) => void run(async () => { setSnapshot(await work()); setSaved(message); });
 return <section aria-label="Cron check-ins"><SectionHead title="Cron check-ins" about={<><p>Spool accepts Sentry cron check-ins at your DSN and forwards each to an Uptime heartbeat you connect here: a start, a success or a failure receipt per check-in. Uptime, not Spool, evaluates schedules and missed runs. With no connection a check-in is counted as unrouted and nothing is sent.</p><p>Paste the separate capability URL Uptime shows once when it issues a heartbeat key. It is kept by this installation, never shown again and never exported.</p></>}/>
  {!snapshot.egress && <p className="callout" role="status">This installation has no egress service installed, so connected check-ins are counted as not routed and nothing is sent.</p>}
  {snapshot.connections.length ? <ul>{snapshot.connections.map(row => <li key={row.slug}><code>{row.slug}</code> → {row.host} · capability URL saved, not shown{' '}
   <label><input type="checkbox" checked={row.enabled} disabled={busy} onChange={event => change(`Forwarding ${event.target.checked ? 'on' : 'off'} for ${row.slug}.`, () => request(item(row.slug), 'PUT', { enabled: event.target.checked }))} /> Forward</label>{' '}
   <button type="button" className="text-button" disabled={busy} onClick={() => change(`Removed ${row.slug}.`, () => request(item(row.slug), 'DELETE'))}>Remove {row.slug}</button></li>)}</ul> : <p>No monitor is connected. Forwarding is off.</p>}
  <form className="form-grid" onSubmit={event => { event.preventDefault(); change(`Connected ${slug}.`, async () => { const result = await request(item(slug), 'PUT', { url, enabled: true }); setSlug(''); setUrl(''); return result; }); }}>
   <Field label="Monitor slug" value={slug} required maxLength={64} pattern="[A-Za-z0-9._-]+" autoComplete="off" onChange={event => setSlug(event.target.value.trim())} />
   <Field label="Uptime heartbeat capability URL" type="password" value={url} required autoComplete="off" onChange={event => setUrl(event.target.value.trim())} />
   <button className="primary-button" disabled={busy || snapshot.connections.length >= snapshot.limit}>Connect monitor</button>{saved && <p role="status">{saved}</p>}
  </form>
 </section>;
}
