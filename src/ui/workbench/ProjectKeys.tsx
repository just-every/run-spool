import { useState } from 'react';
import { Details } from './Details';
import { LoaderSettings } from './LoaderSettings';
import { KeyRateLimit } from './KeyRateLimit';
import { date, type Request, type Run } from './shared';

type Controls = { project: string; request: Request; run: Run; busy: boolean; refresh: () => void };
const kindName = (kind: string) => kind === 'agent' ? 'Agent' : kind === 'deploy' ? 'Deploy' : 'Capture';
export function ProjectKeys({ keys, projectName, configure, organizationManager, projectRole, onKey, ...controls }: Controls & { keys: any[]; projectName: string; configure: boolean; organizationManager: boolean; projectRole?: string; onKey: (grant: any) => void }) {
  const kinds = configure ? ['ingest', 'agent', 'deploy'] : projectRole === 'member' ? ['deploy'] : [];
  return <section className="evidence"><h2>Project keys</h2>
    <p>Capture keys send events. Agent keys read this project’s evidence and submit suggested grouping changes; decisions and apply require the owner. Deploy keys only register releases and upload source maps for this project.</p>
    <p>Archives exclude project keys. After restoring, create new keys for this installation.</p>
    {!keys.length && <p>No project keys have been created here.</p>}
    <div className="button-row">{kinds.map(kind => <button key={kind} className="text-button" disabled={controls.busy} onClick={() => void controls.run(async () => { const grant = await controls.request(`/api/projects/${controls.project}/keys`, 'POST', {kind}); onKey({...grant,kind}); controls.refresh(); })}>Create {kind} key</button>)}</div>
    {keys.map(key => <ProjectKey key={key.hash} credential={key} {...controls} {...{projectName,configure,organizationManager}} revoke={configure || projectRole === 'member' && key.kind === 'deploy'} />)}
  </section>;
}
function ProjectKey({ credential: key, projectName, configure, organizationManager, revoke, project, request, run, busy, refresh }: Controls & {credential: any; projectName: string; configure: boolean; organizationManager: boolean; revoke: boolean}) {
  const [confirming, setConfirming] = useState(false), [failure, setFailure] = useState('');
  const name = `${kindName(key.kind)} key ${key.hash.slice(0,12)}…`;
  const effect = key.kind === 'ingest' ? 'Applications using this key will stop capturing errors and sending events.' : key.kind === 'agent' ? 'Agents using this key will lose evidence access and cannot submit grouping proposals.' : 'Deployments using this key will no longer register releases or upload source maps.';
  return <div className="data-row key-row"><span>{kindName(key.kind)} · {key.revoked ? 'Revoked' : key.stopped ? 'Stopped' : 'Active'}</span><code>{key.hash.slice(0,12)}…</code><span>Created {date(key.created)}</span>
    <Details title="Project key" onOpen={() => {setConfirming(false);setFailure('');}}>
      <p><strong>{name}</strong> · {projectName}</p><p>{key.revoked ? 'Revoked' : key.stopped ? 'Stopped' : 'Active'} · Created {date(key.created)}</p>
      {configure && key.kind === 'ingest' && !key.revoked && !key.stopped && <><LoaderSettings project={project} keyHash={key.hash} {...{request,run,busy}} />{organizationManager && <KeyRateLimit project={project} keyHash={key.hash} {...{request,run,busy}} />}</>}
      {failure && <p role="alert">{failure}</p>}
      {!key.revoked && revoke && (confirming ? <div className="callout" role="group" aria-label="Confirm key revocation">
        <h3>Revoke {name} for {projectName}?</h3><p>{effect} This key cannot be reactivated.</p>
        <button className="danger-button" disabled={busy} onClick={() => void run(async () => { try { await request(`/api/projects/${project}/keys/${key.hash}`, 'DELETE'); setConfirming(false); refresh(); } catch (error) {setFailure((error as Error).message);} })}>Confirm revocation</button>
        <button className="text-button" disabled={busy} onClick={() => setConfirming(false)}>Cancel revoke</button>
      </div> : <button className="danger-button" disabled={busy} onClick={() => setConfirming(true)}>Revoke key</button>)}
    </Details>
  </div>;
}
