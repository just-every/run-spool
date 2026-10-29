import { useEffect, useState } from 'react';
import { SaveState } from './SaveState';
import { SectionHead } from './SectionHead';
import { useSaveState } from './useAutoPreview';
import { date, type Request, type Run } from './shared';

// TEAM-004: commit author and message are personal data; off until the owner chooses, audited. Turning sharing off
// saves as it changes; turning it on sends personal data outside the owner session, so it asks once, under the field.
export function CommitSharing({ project, request, busy }: { project: string; request: Request; run: Run; busy: boolean }) {
 const root = `/api/projects/${encodeURIComponent(project)}/commits/sharing`;
 const [current, setCurrent] = useState<any>(null), [share, setShare] = useState(false), [error, setError] = useState('');
 const { state, save } = useSaveState();
 useEffect(() => { let alive = true; request(root).then(row => { if (alive) { setCurrent(row); setShare(row.share); } }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [root, request]);
 const commit = (value: boolean) => save(async () => { const row = await request(root, 'PUT', { share: value, revision: current.revision }); setCurrent(row); setShare(row.share); });
 return <section className="evidence" aria-labelledby="commit-sharing-title">
  <SectionHead id="commit-sharing-title" title="Commit author and message" about={<p>Commits a deploy key registers keep their author and message for your issue timeline. Evidence packets, agent reads, alerts and exports carry the short ID and commit SHA only, unless you share the author and message here. Retention and erasure remove them either way.</p>} />
  {error && <p role="alert">{error}</p>}
  {!current ? <p role="status">Loading commit sharing…</p> : <>
   <label className="checkbox"><input type="checkbox" checked={share} disabled={busy || state.phase === 'saving'} onChange={e => { const next = e.target.checked; setShare(next); if (!next && current.share) void commit(false); }} /> Share commit author and message outside the owner session</label>
   {share && !current.share && <div className="confirm-line"><p className="meta">Packets, agent reads, alerts and exports will carry each linked commit’s author and message.</p><button className="primary-button" disabled={busy || state.phase === 'saving'} onClick={() => void commit(true)}>Save commit sharing</button></div>}
   <p className="metadata">{current.share ? 'Shared' : 'Not shared'} · {current.revision ? `changed ${date(current.updated)}, recorded in the audit history` : 'default, never changed'}</p>
   <SaveState state={state} />
  </>}
 </section>;
}
