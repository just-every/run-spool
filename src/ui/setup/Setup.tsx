import { useEffect, useRef, useState } from 'react';
import { api } from '../workbench/client';
import { ProjectForm } from '../workbench/ProjectForm';
import { Wordmark } from '../Wordmark';
import { OriginStep, SdkSetup, SendTestError, SentryIntake } from '../workbench/SdkSetup';
import { Field } from '../workbench/shared';
import { ArchiveSettings } from '../workbench/ArchiveSettings';
import './setup.css';

type CreatedProject = { id: string; name: string; ingestKey: string; dsn?: string; devMinted?: boolean };
export function Setup() {
 const [ready, setReady] = useState(false);
 const [restoring, setRestoring] = useState(false);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const [created, setCreated] = useState<CreatedProject | null>(null), [copied, setCopied] = useState(false);
 const [endpoint, setEndpoint] = useState(''), [release, setRelease] = useState('1.0.0'), [build, setBuild] = useState('local');
 const heading = useRef<HTMLHeadingElement>(null), notice = useRef<HTMLDivElement>(null);
 useEffect(() => { setReady(true); setEndpoint(location.origin); heading.current?.focus(); }, [created, restoring]);
 useEffect(() => { if (error) notice.current?.focus(); }, [error]);
 async function run(work: () => Promise<unknown>) {
  setBusy(true); setError('');
  try { await work(); }
  catch (failure) { setError(restoring ? (failure instanceof Error ? failure.message : 'Restore could not be confirmed. Reload to check the installation before trying again.') : 'The project could not be confirmed. Check your identifier and name, or sign in again if your session ended. Reload to check whether it was saved before trying again.'); }
  finally { setBusy(false); }
 }
 async function copyKey() {
  try { await navigator.clipboard.writeText(created!.ingestKey); setCopied(true); setError(''); }
  catch { setError('Copy is unavailable in this browser. Select and copy the key below.'); }
 }
 // The first key is shown once, in memory only. Continue is an explicit owner
 // action; a reload uses durable project existence and never recreates a key.
 return <main className="setup-shell">
  <header className="setup-brand"><Wordmark /><span className="setup-tagline">JavaScript evidence workbench</span></header>
  <section className="setup-panel" aria-labelledby="setup-title">
   <div className="setup-intro"><p className="setup-eyebrow">Your private installation</p>
    <h1 id="setup-title" ref={heading} tabIndex={-1}>{created ? 'Your project is ready' : restoring ? 'Restore your Spool' : 'Create your first project'}</h1>
    <p>{created ? 'Save your ingest key, add the Spool SDK to your app and send a test error. Then open the workbench to see it.' : restoring ? 'Bring your projects, issues and private source evidence into this empty installation.' : 'Give your application a home for errors, releases and private source evidence.'}</p>
    {created && <ol className="setup-next" aria-label="Next in the workbench"><li>Allow your application’s origin</li><li>Upload a source map</li><li>Watch Issues for its first error</li></ol>}
    <img className="setup-illustration" src="/theme/spool-drawing.svg" alt="" width="240" height="220" />
   </div>
   <div className="setup-content">
    {error && <div ref={notice} tabIndex={-1} role="alert" className="callout status-notice">{error} <a href="/sign-in">Sign in again</a></div>}
    {created ? <>
     <h2>{created.name}</h2><p>Copy this ingest key now. It is shown only once. If you lose it, create a new ingest key in Settings.</p>
     {created.devMinted && <aside className="callout"><strong>Connect your app to local Spool with this key.</strong><p>This ingest key sends errors to this project without the private dev gate. Allow your browser app’s exact origin below. Never give your app the <code>RER_OPEN</code> link or <code>SPOOL_DEV_KEY</code>.</p><p>This dev key is refused by deployed Spool. Sign in there and create a fresh key when you deploy.</p></aside>}
     <div className="secret-key setup-key"><label htmlFor="setup-ingest-key">Ingest key</label><textarea id="setup-ingest-key" rows={2} readOnly value={created.ingestKey} spellCheck={false} autoComplete="off" /><button className="text-button" type="button" onClick={() => void copyKey()}>Copy ingest key</button><p role="status">{copied ? 'Key copied.' : ''}</p></div>
     <div className="setup-release"><Field label="Release" value={release} required pattern="[a-zA-Z0-9._:@+\-]+" onChange={event => setRelease(event.target.value)} /><Field label="Build" value={build} required pattern="[a-zA-Z0-9._:\-]+" onChange={event => setBuild(event.target.value)} /></div>
     {endpoint && <SdkSetup endpoint={endpoint} project={created.id} ingestKey={created.ingestKey} release={release} build={build} />}
     <OriginStep project={created.id} request={api} />
     <SendTestError project={created.id} ingestKey={created.ingestKey} release={release} build={build} request={api} />
     <SentryIntake dsn={created.dsn} />
     <a className="primary-button setup-continue" href="/">Continue to workbench</a>
    </> : restoring ? <>
     <ArchiveSettings busy={busy || !ready} empty run={run} refresh={() => location.assign('/')} allowDownload={false} />
     <button className="text-button setup-alternative" disabled={busy} onClick={() => { setRestoring(false); setError(''); }}>Create a project instead</button>
    </> : <>
     <h2>One project per application</h2><p>Choose a stable identifier such as <code className="mark">web-app</code> and a name you will recognize. You can create more projects later.</p>
     <ProjectForm request={api} run={run} busy={busy || !ready} onCreated={setCreated} />
     <p className="setup-note">The next step shows your ingest key once, with the SDK setup for your application.</p>
     <div className="setup-alternative"><p>Moving from another Spool? Restore before creating a project.</p><button className="text-button" disabled={busy || !ready} onClick={() => { setRestoring(true); setError(''); }}>Restore a private archive</button></div>
     <noscript><p>Project creation needs JavaScript. Enable it and reload this page to continue.</p></noscript>
    </>}
   </div>
  </section>
 </main>;
}
