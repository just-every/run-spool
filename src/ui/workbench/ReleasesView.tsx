import { Link } from '@tanstack/react-router';
import { Fold } from './Fold';
import { hrefFor } from './location';
import { MissingContent } from './NotFound';
import './live-copy.css';
import {ReleaseHealth} from './ReleaseHealth';
import { DeploymentHistory } from './DeploymentHistory';
import { RepositoryLinkLog } from './RepositoryLinkLog';
import { useEffect, useRef,useState } from 'react';
import { Details } from './Details';
import { SourceMapSetup } from './SourceMapSetup';
import { date, Field, useDraft, type Request, type Run } from './shared';
export interface UploadTarget { id: string; release: string; debugId: string; issue: string }
export function ReleasesView({ project, releases, busy, request, run, refresh, target, onUploaded, selectedRelease, sourceMapSetup, loading, readOnly = false, manageOrganization = true }: {
  project: string; releases: any[]; busy: boolean; request: Request; run: Run; refresh: () => void; target?: UploadTarget; selectedRelease?: string; sourceMapSetup?: boolean; loading?: boolean; onUploaded: (issue: string) => void; readOnly?: boolean; manageOrganization?: boolean;
}) {
  const [noRelease,setNoRelease]=useState<number|null>(null);
  useEffect(()=>{if(readOnly)return;let alive=true;request(`/api/projects/${encodeURIComponent(project)}/release-policy`).then(row=>{if(alive)setNoRelease(row.noReleaseEvents)}).catch(()=>{if(alive)setNoRelease(null)});return()=>{alive=false}},[project,request,releases,readOnly]);
  const [name, setName] = useDraft(`${project}.release-name`, ''), [build, setBuild] = useDraft(`${project}.release-build`, '');
  const [commitSha,setCommitSha]=useDraft(`${project}.manifest-commit`,''),[repository,setRepository]=useDraft(`${project}.manifest-repo`,''),[environment,setEnvironment]=useDraft(`${project}.manifest-environment`,''),[deployedAt,setDeployedAt]=useDraft(`${project}.manifest-time`,'');
  const [pathMappings,setPathMappings]=useDraft(`${project}.manifest-paths`,'');
  const [selected, setSelected] = useDraft(`${project}.map-release`, ''), [debug, setDebug] = useDraft(`${project}.map-debug`, '');
  const [map, setMap] = useDraft<any>(`${project}.map-file`, null), [error, setError] = useDraft(`${project}.map-error`, ''), [result, setResult] = useDraft(`${project}.map-result`, '');
  const [handledTarget, setHandledTarget] = useDraft(`${project}.map-handled-target`, '');
  const [context, setContext] = useDraft<UploadTarget | undefined>(`${project}.map-context`, undefined);
  const [edited, setEdited] = useDraft(`${project}.map-edited`, false);
  const selection = useRef(0), fileInput = useRef<HTMLInputElement>(null), pendingTarget = target?.id !== handledTarget ? target : undefined;
  function applyTarget(next: UploadTarget) {
    // Replacing a draft is one explicit action, including its selected file.
    ++selection.current; setSelected(next.release); setDebug(next.debugId); setMap(null);
    if (fileInput.current) fileInput.current.value = '';
    setError(''); setResult(''); setEdited(false); setContext(next); setHandledTarget(next.id);
  }
  useEffect(() => { if (pendingTarget && !edited && !map) applyTarget(pendingTarget); }, [pendingTarget, edited, map]);
  useEffect(() => {
    if (!sourceMapSetup) return;
    const section = document.getElementById('source-map-setup');
    if (!section) return;
    let frame = 0;
    const scroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => section.scrollIntoView({ block: 'start' })); };
    const observer = new ResizeObserver(scroll);
    const stop = () => { observer.disconnect(); cancelAnimationFrame(frame); };
    for (const sibling of section.parentElement?.children ?? []) observer.observe(sibling);
    scroll();
    window.addEventListener('wheel', stop, { once: true });
    window.addEventListener('touchstart', stop, { once: true });
    window.addEventListener('keydown', stop, { once: true });
    return () => { stop(); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); window.removeEventListener('keydown', stop); };
  }, [sourceMapSetup, project]);
  if (selectedRelease) {
    const row = releases.find(item => item.name === selectedRelease);
    if (!row && loading) return <section className="evidence"><p role="status">Loading release…</p></section>;
    return row ? <section className="evidence"><Link className="text-button" to={hrefFor(project, 'releases') as any}>All releases</Link><h2>{row.name}</h2><ReleaseFacts row={row} /></section> : <MissingContent />;
  }
  if (readOnly) return <>
    <ReleaseHealth {...{project,request}} />
    <RepositoryLinkLog {...{project,request,releases}} />
    <section className="evidence"><h2>Release history</h2>{releases.length ? <div className="table-region"><table className="data-table"><thead><tr><th scope="col">Release</th><th scope="col">Build identifier</th><th scope="col">First seen</th></tr></thead><tbody>{releases.map(row => <tr className="data-row" key={row.name}><th scope="row"><Link className="inline-link" to={hrefFor(project, 'releases', row.name) as any}><strong>{row.name}</strong></Link></th><td data-label="Build identifier"><code>{row.build}</code></td><td data-label="First seen">{date(row.first_seen ?? row.created)}</td></tr>)}</tbody></table></div> : <p>No releases recorded.</p>}</section>
  </>;
  const release = releases.find(row => row.name === selected);
  return <>
    <section className="evidence"><h2>Release history</h2><Details title="Events without a release"><p>{noRelease === null ? 'The count of events without a release is unavailable.' : `${noRelease} events have no release.`} <a className="inline-link" href={`${hrefFor(project)}?q=${encodeURIComponent('!has:release')}`}>Find events without a release</a></p></Details>{releases.length ? <div className="table-region"><table className="data-table"><thead><tr><th scope="col">Release</th><th scope="col">Build identifier</th><th scope="col">First seen</th><th scope="col"><span className="visually-hidden">Details</span></th></tr></thead><tbody>{releases.map(row => <tr className="data-row" key={row.name}><th scope="row"><Link className="inline-link" to={hrefFor(project, 'releases', row.name) as any}><strong>{row.name}</strong></Link>{row.auto_created===1&&<span> · Created automatically</span>}{row.first_environment&&<p>{row.first_environment}</p>}</th><td data-label="Build identifier"><code>{row.build}</code></td><td data-label="First seen">{date(row.first_seen ?? row.created)}</td><td><Details title={`Release ${row.name}`}><ReleaseFacts row={row} /></Details></td></tr>)}</tbody></table></div> : <p>Register your first release above before connecting your application.</p>}</section>
    <div className="page-tail">
    <Fold title="Register a release" id="register-release" initialOpen={!releases.length} meta={releases.length ? `${releases.length} registered · latest ${releases.at(-1)?.name}` : 'No release registered yet'}><form className="form-grid" onSubmit={e => { e.preventDefault(); void run(async () => { await request(`/api/projects/${project}/releases`, 'POST', { name, build, ...(commitSha||repository||environment||deployedAt||pathMappings?{manifest:{commitSha,repository,environment,deployedAt:new Date(deployedAt).toISOString(),...(pathMappings.trim()?{pathMappings:JSON.parse(pathMappings)}:{})}}:{}) }); if (!edited && !map) setSelected(name); setName(''); setBuild(''); refresh(); }); }}><Field label="Release name" required pattern={String.raw`[a-zA-Z0-9._:@+\-]+`} value={name} onChange={e => setName(e.target.value)} /><Field label="Build identifier" required pattern={String.raw`[a-zA-Z0-9._:\-]+`} value={build} onChange={e => setBuild(e.target.value)} /><details className="form-more"><summary>Deployment manifest and server path mappings (optional)</summary><div className="form-grid"><Field label="Deployment commit SHA (optional manifest)" value={commitSha} onChange={e=>setCommitSha(e.target.value)} /><Field label="HTTPS repository URL" value={repository} onChange={e=>setRepository(e.target.value)} /><Field label="Deployment environment" value={environment} onChange={e=>setEnvironment(e.target.value)} /><Field label="Deployed at" type="datetime-local" value={deployedAt} onChange={e=>setDeployedAt(e.target.value)} /><label className="form-field">Server stack path mappings (Go/Python, optional JSON)<textarea value={pathMappings} onChange={e=>setPathMappings(e.target.value)} placeholder={'[ {"from":"/build/service","to":"src"} ]'} /></label></div></details><button className="primary-button" disabled={busy}>Register release</button></form><Details title="Release order"><p>Native intake uses registered sequence for regression protection. Sentry intake uses the project ordering rule in Settings, shared with release lists and latest. Sentry intake can create releases without registration. Registration does not prove deployment. An optional manifest requires all four deployment fields and binds a release and environment immutably to its commit and deployment time. Register the same release with another environment to record that deployment; changing an existing binding conflicts. Go path mappings use up to 20 from/to prefixes; to is repository relative (a single dot means repository root), and the longest complete path prefix wins. Mappings do not symbolicate binaries.</p></Details></Fold>
    <Fold title="Upload a prepared source map" id="upload-map" initialOpen={!!context || !!pendingTarget} meta={context ? `For ${context.release} · debug ID ${context.debugId || 'from the map'}` : 'Stamped Source Map V3 files up to 256 KiB'}><Details title="Prepared source maps"><p>Choose a stamped map to fill in its debug ID automatically.</p></Details>{context && <p>Match the map to the occurrence you were investigating.</p>}
    {pendingTarget && (edited || map) && <div className="callout" role="status"><strong>Your source map draft is still here.</strong><p>Use the requested issue’s release and debug ID only if you want to replace this draft. Replacing it also clears the selected map file.</p><button className="text-button" onClick={() => setHandledTarget(pendingTarget.id)}>Keep current draft</button><button className="text-button" onClick={() => applyTarget(pendingTarget)}>Replace draft with this issue</button></div>}
    <form className="form-grid" onSubmit={e => { e.preventDefault(); void run(async () => {
      if (!release || !map) throw new Error('Choose a registered release and a source map.');
      await request(`/api/projects/${project}/artifacts`, 'POST', { release: release.name, build: release.build, debugId: debug, map: map.value });
      setMap(null); setEdited(false); if (fileInput.current) fileInput.current.value = ''; setResult('Source map uploaded. Matching frames can now show their original source.'); refresh();
    }); }}><label className="form-field">Release<select required value={selected} onChange={e => { setSelected(e.target.value); setEdited(true); }}><option value="">Choose a release</option>{releases.map(row => <option key={row.name}>{row.name}</option>)}</select></label><Field label="Bundle debug ID" required aria-describedby="map-debug-help" value={debug} onChange={e => { setDebug(e.target.value); setEdited(true); }} /><label className="form-field">Source map file · max 256 KiB<input ref={fileInput} type="file" accept=".map,.json,application/json" aria-invalid={!!error} aria-describedby={error ? 'map-error' : undefined} onChange={e => {
      const current = ++selection.current, file = e.target.files?.[0]; setMap(null); setError(''); setResult(''); setEdited(true);
      if (!file) return;
      void (async () => { try { if (file.size > 262144) throw new Error('Map exceeds 256 KiB.'); const value = JSON.parse(await file.text()); if (!value || value.version !== 3 || !Array.isArray(value.sources) || typeof value.mappings !== 'string') throw new Error('Choose a flat Source Map V3 file.'); if (selection.current === current) { setMap({ name: file.name, value }); if (typeof (value.debug_id ?? value.debugId) === 'string') setDebug(value.debug_id ?? value.debugId); } } catch (failure) { if (selection.current === current) setError(failure instanceof SyntaxError ? 'Invalid source map JSON.' : (failure as Error).message); } })();
    }} /></label>{error && <p id="map-error" role="alert">{error}</p>}{map && <p>Ready to upload: {map.name}</p>}<button className="primary-button" disabled={busy || !map || !release}>Upload matching map</button></form>{result && <p role="status">{result}</p>}{context && <button className="text-button" onClick={() => onUploaded(context.issue)}>Return to issue</button>}<Details title="Source map requirements"><p id="map-debug-help">Use the map’s <code>debug_id</code> or the bundle’s <code>//# debugId=…</code> comment. Missing both? Run the setup above.</p><p>Maps must be flat Source Map V3 files, up to 256 KiB, with exact project, release, build and debug ID matches. Each project holds up to 20 maps. Source contents remain private and are excluded from issue packets. No remote source URL is fetched.</p><p>The debug ID joins a built bundle to its map. Use the build plugin or CLI in the setup on this page to generate and stamp both files, then deploy those exact output files. Selecting a prepared map reads its <code>debug_id</code> into the form.</p></Details></Fold>
    <ReleaseHealth {...{project,request}} />
    <DeploymentHistory {...{project,releases,request,run,busy}} />
    <RepositoryLinkLog {...{project,request,releases}} />
    {manageOrganization && <SourceMapSetup {...{ project, releases, request, run, busy, refresh }} open={sourceMapSetup} />}
    </div>
  </>;
}

function ReleaseFacts({ row }: { row: any }) {
  const deployments = typeof row.deployments === 'string' ? JSON.parse(row.deployments) : row.deployments ?? [];
  const deploys = typeof row.cli_deploys === 'string' ? JSON.parse(row.cli_deploys) : row.cli_deploys ?? [];
  const sdk = typeof row.creating_sdk === 'string' ? JSON.parse(row.creating_sdk) : row.creating_sdk;
  return <div className="release-facts">
    <p>Build <code>{row.build}</code></p>
    <p>{row.auto_created === 1 ? 'Created automatically from the first event' : 'Registered'} · {date(row.created)}</p>
    {row.first_seen && <p>First event · {date(row.first_seen)}{row.first_environment ? ` in ${row.first_environment}` : ''}</p>}
    {sdk?.name && <p>Received from {sdk.name}{sdk.version ? ` ${sdk.version}` : ''}</p>}
    {row.finalized && <p>Finalized · {date(row.finalized)}</p>}
    {row.commit_count != null && <p>{row.commit_count} linked {row.commit_count === 1 ? 'commit' : 'commits'}</p>}
    {deployments.map((deployment: any, index: number) => <div key={index}><h3>Deployment in {deployment.environment}</h3><p>{date(new Date(deployment.deployedAt).getTime())} · <a className="inline-link" href={deployment.repository} target="_blank" rel="noreferrer">Repository</a></p><p>Commit <code>{deployment.commitSha}</code></p>{deployment.pathMappings?.length > 0 && <ul>{deployment.pathMappings.map((mapping: any, index: number) => <li key={index}>Paths from <code>{mapping.from}</code> map to <code>{mapping.to}</code>.</li>)}</ul>}</div>)}
    {deploys.map((deploy: any) => <p key={deploy.id}>{deploy.name ?? 'Deployment'}{deploy.environment ? ` in ${deploy.environment}` : ''} · started {date(deploy.started)}{deploy.finished ? ` · finished ${date(deploy.finished)}` : ''}{deploy.url && <> · <a className="inline-link" href={deploy.url} target="_blank" rel="noreferrer">Open deployment</a></>}</p>)}
    {!deployments.length && !deploys.length && <p>No deployments recorded.</p>}
  </div>;
}
