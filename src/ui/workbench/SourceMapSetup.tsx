import { useEffect, useRef, useState } from 'react';
import { Fold } from './Fold';
import { CodeBlock, installCommand } from './SdkSetup';
import { Field, useDraft, type Request, type Run } from './shared';
import { bundlers, shellQuote, sourceMapInstructions, type Bundler } from './sourceMapSnippets';

export function SourceMapSetup({ project, releases, request, run, busy, refresh, open = false }: {
  project: string; releases: any[]; request: Request; run: Run; busy: boolean; refresh: () => void; open?: boolean;
}) {
  const [storage,setStorage]=useState<any>(null),[uploads,setUploads]=useState<any>(null);
  const [cap,setCap]=useDraft(`${project}.artifact-cap`,''),[capEdited,setCapEdited]=useDraft(`${project}.artifact-cap-edited`,false);
  const capDraft=useRef({project,edited:capEdited});capDraft.current={project,edited:capEdited};
  useEffect(()=>{let live=true;Promise.all([request(`/api/projects/${encodeURIComponent(project)}/artifact-storage`),request(`/api/projects/${encodeURIComponent(project)}/sentry-uploads`)]).then(([setting,rows])=>{if(live){setStorage(setting);if(capDraft.current.project===project&&!capDraft.current.edited)setCap(setting.artifact_storage_cap===null?'':String(setting.artifact_storage_cap));setUploads(rows)}}).catch(()=>{if(live){setStorage(null);setUploads(null)}});return()=>{live=false}},[project,request,releases]);
  const [endpoint, setEndpoint] = useState(''), [deployKey, setDeployKey] = useState('');
  const [bundler, setBundler] = useDraft<Bundler>(`${project}.map-bundler`, 'vite');
  const [release, setRelease] = useDraft(`${project}.map-setup-release`, releases[0]?.name ?? '');
  const [build, setBuild] = useDraft(`${project}.map-setup-build`, releases[0]?.build ?? '');
  useEffect(() => { setEndpoint(location.origin); }, []);
  useEffect(() => {
    if (!release && !build && releases[0]) { setRelease(releases[0].name); setBuild(releases[0].build); }
  }, [releases, release, build]);
  const ready = !!endpoint && /^[a-zA-Z0-9._:@+\-]+$/.test(release) && /^[a-zA-Z0-9._:\-]+$/.test(build);
  const instructions = sourceMapInstructions(bundler, { endpoint, project, release, build });
  return <Fold title="Set up original-source mapping" className="source-map-setup" id="source-map-setup" headingId="source-map-setup-heading" initialOpen={open} meta={storage ? `${storage.count} ${storage.count === 1 ? 'map' : 'maps'} stored · build plugin or CLI steps` : 'Build plugin or CLI steps'}>
    <p>A source map connects a built JavaScript file’s line and column to the same code in your original source.</p>
    <p>Run these steps in your application’s repository before deploying its built files. The tool generates a <strong>debug ID</strong>, stamps that same ID into the bundle and its map, registers the release and uploads the map. You do not need to invent or enter an ID.</p>
    <h3>Artifact storage</h3>
    {storage ? <><p>{storage.count} maps use {storage.bytes} stored bytes. An empty cap allows uploads without a project byte cap. Lowering the cap preserves stored maps and limits future uploads.</p><div className="form-grid"><Field label="Artifact storage cap (bytes, optional)" type="number" min="0" step="1" value={cap} onChange={e=>{capDraft.current.edited=true;setCapEdited(true);setCap(e.target.value)}} /><button className="text-button" disabled={busy||(cap!==''&&(!Number.isSafeInteger(Number(cap))||Number(cap)<0))} onClick={()=>void run(async()=>{const setting=await request(`/api/projects/${encodeURIComponent(project)}/artifact-storage`,'PUT',{revision:storage.revision,artifact_storage_cap:cap===''?null:Number(cap)});setStorage(setting);capDraft.current.edited=false;setCapEdited(false);setCap(setting.artifact_storage_cap===null?'':String(setting.artifact_storage_cap));refresh()})}>Save artifact cap</button></div></> : <p role="status">Artifact storage setting unavailable.</p>}
    {uploads?.builds?.map((row:any)=><p key={`${row.release}:${row.build}`}><strong>{row.release} / {row.build}: {row.state}</strong>{row.missing.length>0&&<> · Missing: {row.missing.join(', ')}</>}</p>)}
    {uploads&&<details><summary>Stored maps and upload failures</summary>{uploads.artifacts.length?<ul>{uploads.artifacts.map((row:any)=><li key={`${row.release}:${row.build}:${row.debug}`}><code>{row.release} / {row.build} / {row.debug}</code> · {row.bytes} bytes</li>)}</ul>:<p>No maps uploaded.</p>}{uploads.assemblies.filter((row:any)=>row.state==='error').map((row:any)=><p key={row.checksum} style={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{row.detail}</p>)}</details>}
    <h3>1. Match your application’s release</h3>
    <p>Use exactly the <code>release</code> and <code>build</code> from your SDK’s <code>init</code>. A new release is registered automatically when the upload runs.</p>
    <div className="form-grid">
      <Field label="Application release" required pattern={String.raw`[a-zA-Z0-9._:@+\-]+`} value={release} placeholder="web@1.0.0" onChange={e => setRelease(e.target.value)} />
      <Field label="Application build" required pattern={String.raw`[a-zA-Z0-9._:\-]+`} value={build} placeholder="build-1" onChange={e => setBuild(e.target.value)} />
      <label className="form-field">Your bundler<select value={bundler} onChange={e => setBundler(e.target.value as Bundler)}>{bundlers.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</select></label>
    </div>
    <h3>2. Create a build-only key</h3>
    <p>This deploy key can only register releases and upload maps for <code>{project}</code>. Keep it in your build terminal or CI secret store, outside browser code and source control. It is shown here until you leave this page or reload; revoke it in Settings when no longer needed.</p>
    {deployKey ? <div className="secret-key source-map-key">
      <CodeBlock label="Deploy key environment" code={`export SPOOL_DEPLOY_KEY=${shellQuote(deployKey)}`} />
      <button className="text-button" onClick={() => setDeployKey('')}>Hide deploy key</button>
    </div> : <button className="text-button" disabled={busy} onClick={() => void run(async () => {
      const grant = await request(`/api/projects/${encodeURIComponent(project)}/keys`, 'POST', { kind: 'deploy' });
      setDeployKey(grant.key); refresh();
    })}>Create source-map deploy key</button>}
    <p className="muted">Copy the environment line into your build terminal before running the commands below. In CI, save the key as <code>SPOOL_DEPLOY_KEY</code>. Local dev keys work only with this local installation; create a fresh key on hosted Spool.</p>
    <h3>3. Build, stamp and upload</h3>
    <CodeBlock label="Source-map SDK install" code={installCommand} />
    {ready ? <>
      <CodeBlock label={instructions.label} code={instructions.config} />
      <CodeBlock label="Source-map build and upload" code={instructions.command} />
    </> : <p role="status">Enter a valid application release and build above to fill in the commands for this project and endpoint. Use letters, numbers, dots or hyphens; release names also allow @ and +.</p>}
    <p>Merge the configuration into your existing config. For CLI builds, replace <code>src/index.js</code> and <code>dist/*.js</code> with your entry point and every emitted bundle, including nested chunks. Each bundle needs its adjacent <code>.map</code>. Deploy the <strong>stamped output</strong> after upload; rebuilding afterwards removes its matching ID. Keep maps private when publishing assets.</p>
    <h3>4. Confirm a mapped frame</h3>
    <p>The CLI prints the uploaded map count. The published SDK 0.1.0 Vite/Rollup plugin is silent on success; an upload failure fails the build. Trigger a new error in your deployed application, open its issue in Spool, then look for <strong>Original source</strong> and a frame such as <code>src/checkout.js:7:12</code>. Spool’s own test exception checks capture only, not your app’s maps.</p>
    <h3>If the frame is still unmapped</h3>
    <ul>
      <li>No event: allow the app’s exact scheme, host and port on Capture, and check its ingest key and registered release.</li>
      <li>Upload refused: check the deploy key belongs to this project and installation, and is exported as <code>SPOOL_DEPLOY_KEY</code>. CLI uploads accept flat or indexed V3 maps up to 1 MiB each, without a lifetime map count. Check the project byte cap above. The prepared-map picker below retains its smaller flat-map limit.</li>
      <li>Missing map or debug ID: confirm the served bundle ends in <code>//# debugId=…</code> and its adjacent map’s <code>debug_id</code> matches. Deploy those exact stamped files, clear old cached bundles and trigger a new error.</li>
      <li>Map uploaded but no original location: match the event’s project, release and build exactly; include every chunk’s map and check the map contains mappings for the failing line.</li>
    </ul>
  </Fold>;
}
