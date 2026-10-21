import { useEffect, useState } from 'react';
import { date, type Request, type Run } from './shared';

// TEAM-004: commit author and message are personal data; off until the owner chooses, audited.
export function CommitSharing({ project, request, run, busy }: { project: string; request: Request; run: Run; busy: boolean }) {
 const root = `/api/projects/${encodeURIComponent(project)}/commits/sharing`;
 const [current, setCurrent] = useState<any>(null), [share, setShare] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
 useEffect(() => { let alive = true; request(root).then(row => { if (alive) { setCurrent(row); setShare(row.share); } }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [root, request]);
 return <section className="evidence" aria-labelledby="commit-sharing-title"><h2 id="commit-sharing-title">Commit author and message</h2>
  <p>Commits a deploy key registers keep their author and message for your issue timeline. Evidence packets, agent reads, alerts and exports carry the short ID and commit SHA only, unless you share the author and message here. Retention and erasure remove them either way.</p>
  {error && <p role="alert">{error}</p>}
  {!current ? <p role="status">Loading commit sharing…</p> : <>
   <label className="checkbox"><input type="checkbox" checked={share} disabled={busy} onChange={e => { setShare(e.target.checked); setStatus(''); }} /> Share commit author and message outside the owner session</label>
   <p className="metadata">{current.share ? 'Shared' : 'Not shared'} · {current.revision ? `changed ${date(current.updated)}, recorded in the audit history` : 'default, never changed'}</p>
   <button className="primary-button" disabled={busy || share === current.share} onClick={() => void run(async () => { try { setError(''); const row = await request(root, 'PUT', { share, revision: current.revision }); setCurrent(row); setShare(row.share); setStatus(row.share ? 'Commit author and message are now shared.' : 'Commit author and message are no longer shared.'); } catch (e) { setError((e as Error).message); } })}>Save commit sharing</button>
   {status && <p role="status">{status}</p>}
  </>}
 </section>;
}
