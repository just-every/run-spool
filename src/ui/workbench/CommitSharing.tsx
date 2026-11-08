import { date, type Request, type Run } from './shared';
import { useSettingDoc } from './useSettingDoc';
import { SaveAnnouncer, SaveFailure, SavedMark } from './SaveMarks';

// TEAM-004: commit author and message are personal data; off until the owner chooses, audited.
// Turning sharing on has an outside effect, so it asks once under the checkbox; turning it off saves at once.
export function CommitSharing({ project, request }: { project: string; request: Request; run?: Run; busy?: boolean }) {
 const root = `/api/projects/${encodeURIComponent(project)}/commits/sharing`;
 const doc = useSettingDoc<any, boolean>({
  key: `commit-sharing:${project}`, read: () => request(root), draftOf: row => row.share,
  write: (row, share, keepalive) => request(root, 'PUT', { share, revision: row.revision }, { keepalive }),
 });
 const current = doc.data;
 return <section className="evidence" aria-labelledby="commit-sharing-title"><h2 id="commit-sharing-title">Commit author and message</h2>
  <p>Commits a deploy key registers keep their author and message for your issue timeline. Evidence packets, agent reads, alerts and exports carry the short ID and commit SHA only, unless you share the author and message here. Retention and erasure remove them either way.</p>
  {doc.loadError && <p role="alert">{doc.loadError}</p>}
  {!current ? <p role="status">{doc.loadError ? 'Commit sharing unavailable.' : 'Loading commit sharing…'}</p> : <>
   <label className="checkbox"><input type="checkbox" checked={!!doc.draft} onChange={e => e.target.checked ? doc.edit(true, { hold: true }) : doc.held ? doc.discard() : doc.edit(false, { now: true })} /> Share commit author and message outside the owner session<SavedMark doc={doc} /></label>
   {doc.held && <div className="save-confirm"><p>Agent reads, alerts and exports will carry each commit’s author and message.</p><div className="button-row"><button type="button" className="primary-button" onClick={() => void doc.commit()}>Share author and message</button><button type="button" className="text-button" onClick={doc.discard}>Keep private</button></div></div>}
   <SaveFailure doc={doc} />
   <p className="metadata">{current.share ? 'Shared' : 'Not shared'} · {current.revision ? `changed ${date(current.updated)}, recorded in the audit history` : 'default, never changed'}</p>
   <SaveAnnouncer doc={doc} />
  </>}
 </section>;
}
