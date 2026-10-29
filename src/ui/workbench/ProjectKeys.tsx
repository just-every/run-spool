import { Details } from './Details';
import { LoaderSettings } from './LoaderSettings';
import { SectionHead } from './SectionHead';
import { date, type Request, type Run } from './shared';

export function ProjectKeys({ project, keys, credentialKinds, configure, member, request, run, busy, refresh, onKey }: {
  project: string; keys: any[]; credentialKinds: string[]; configure: boolean; member: boolean; request: Request; run: Run; busy: boolean; refresh: () => void; onKey: (grant: { key: string; dsn?: string; kind: string }) => void;
}) {
  return <section className="evidence" aria-labelledby="project-keys-title">
    <SectionHead id="project-keys-title" title="Project keys" about={<><p>Capture keys send events. Agent keys read this project’s evidence and submit inert grouping proposals; decisions and apply require the owner. Deploy keys only register releases and upload source maps for this project.</p><p>Archives exclude project keys. After restoring, create new keys for this installation.</p></>}>
      {credentialKinds.map(kind => <button key={kind} className="text-button" disabled={busy} onClick={() => void run(async () => { const grant = await request(`/api/projects/${project}/keys`, 'POST', { kind }); onKey({ ...grant, kind }); refresh(); })}>Create {kind} key</button>)}
    </SectionHead>
    {!keys.length && <p>No project keys have been created here.</p>}
    {keys.map(key => <div className="data-row key-row" key={key.hash}><span>{key.kind === 'agent' ? 'Agent' : key.kind === 'deploy' ? 'Deploy' : 'Capture'} · {key.revoked ? 'Revoked' : key.stopped ? 'Stopped' : 'Active'}</span><code>{key.hash.slice(0, 12)}…</code><span>Created {date(key.created)}</span><Details title="Project key"><pre>{JSON.stringify(key, null, 2)}</pre>{configure && key.kind === 'ingest' && !key.revoked && !key.stopped && <LoaderSettings project={project} keyHash={key.hash} {...{ request, run, busy }} />}{!key.revoked && (configure || (member && key.kind === 'deploy')) && <button className="danger-button" disabled={busy} onClick={() => void run(async () => { await request(`/api/projects/${project}/keys/${key.hash}`, 'DELETE'); refresh(); })}>Revoke key</button>}</Details></div>)}
  </section>;
}
