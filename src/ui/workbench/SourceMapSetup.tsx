import { useEffect, useState } from 'react';
import { CodeBlock, installCommand } from './SdkSetup';
import { Field, useDraft, type Request, type Run } from './shared';
import { bundlers, shellQuote, sourceMapInstructions, type Bundler } from './sourceMapSnippets';

export function SourceMapSetup({ project, releases, request, run, busy, refresh }: {
  project: string; releases: any[]; request: Request; run: Run; busy: boolean; refresh: () => void;
}) {
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
  return <section className="evidence source-map-setup" id="source-map-setup" aria-labelledby="source-map-setup-heading">
    <h2 id="source-map-setup-heading">Set up original-source mapping</h2>
    <p>A source map connects a built JavaScript file’s line and column to the same code in your original source.</p>
    <p>Run these steps in your application’s repository before deploying its built files. The tool generates a <strong>debug ID</strong>, stamps that same ID into the bundle and its map, registers the release and uploads the map. You do not need to invent or enter an ID.</p>
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
      <li>Upload refused: check the deploy key belongs to this project and installation, and is exported as <code>SPOOL_DEPLOY_KEY</code>. Maps must be flat V3, at most 256 KiB each, with at most 20 per project.</li>
      <li>Missing map or debug ID: confirm the served bundle ends in <code>//# debugId=…</code> and its adjacent map’s <code>debug_id</code> matches. Deploy those exact stamped files, clear old cached bundles and trigger a new error.</li>
      <li>Map uploaded but no original location: match the event’s project, release and build exactly; include every chunk’s map and check the map contains mappings for the failing line.</li>
    </ul>
  </section>;
}
