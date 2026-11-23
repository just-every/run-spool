import { useEffect, useRef, useState } from 'react';
import { api } from '../workbench/client';
import { ProjectForm } from '../workbench/ProjectForm';
import { Wordmark } from '../Wordmark';
import { OriginStep, SdkSetup, SendTestError, SentryIntake } from '../workbench/SdkSetup';
import { Field } from '../workbench/shared';
import { SetupIdentity, useSetupIdentity } from './SetupIdentity';
import { LocalCaptureNote } from '../workbench/localEndpoint';
import { ArchiveSettings } from '../workbench/ArchiveSettings';
import './setup.css';

type CreatedProject = { id: string; name: string; ingestKey: string; dsn?: string; devMinted?: boolean };
export function Setup() {
 const identity = useSetupIdentity(api);
 useEffect(() => { document.title = identity.value.installationName ? `${identity.value.installationName} · Spool` : 'Spool'; }, [identity.value.installationName]);
 const [ready, setReady] = useState(false);
 const [restoring, setRestoring] = useState(false);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const [sendingTest, setSendingTest] = useState(false);
 const [created, setCreated] = useState<CreatedProject | null>(null), [copied, setCopied] = useState(false);
 const [endpoint, setEndpoint] = useState(''), [release, setRelease] = useState('1.0.0'), [build, setBuild] = useState('local');
 const heading = useRef<HTMLHeadingElement>(null), notice = useRef<HTMLDivElement>(null);
 useEffect(() => { setReady(true); setEndpoint(location.origin); heading.current?.focus(); }, [created, restoring]);
 useEffect(() => { if (error) notice.current?.focus(); }, [error]);
 async function run(work: () => Promise<unknown>) {
  setBusy(true); setError('');
  try { await work(); }
  catch (failure) { setError(failure instanceof Error ? failure.message : 'The change could not be confirmed. Reload to check whether it was saved before trying again.'); }
  finally { setBusy(false); }
 }
 async function copyKey() {
  try { await navigator.clipboard.writeText(created!.ingestKey); setCopied(true); setError(''); }
  catch { setError('Copy is unavailable in this browser. Select and copy the key below.'); }
 }
 // The first key is shown once, in memory only. Continue is an explicit owner
 // action; a reload uses durable project existence and never recreates a key.
 return <main className="setup-shell">
  <header className="setup-brand"><Wordmark className={identity.value.installationName ? 'setup-installation-wordmark' : undefined} name={identity.value.installationName ? `${identity.value.installationName} · Spool` : undefined} /><span className="setup-tagline">JavaScript evidence workbench</span></header>
  <section className="setup-panel" aria-labelledby="setup-title">
   <div className="setup-intro"><p className="setup-eyebrow">Your private installation</p>
    <h1 id="setup-title" ref={heading} tabIndex={-1}>{created ? 'Your project is ready' : restoring ? 'Restore your Spool' : 'Create your first project'}</h1>
    <p>{created ? 'Follow these three steps to connect your app.' : restoring ? 'Bring your projects, issues and private source evidence into this empty installation.' : 'Give your application a home for errors, releases and private source evidence.'}</p>
    <img className="setup-illustration" src="/theme/spool-drawing.svg" alt="" width="240" height="220" />
   </div>
   <div className="setup-content">
    {(error || identity.error) && <div ref={notice} tabIndex={-1} role="alert" className="callout status-notice">{error || identity.error} {!restoring && <a href="/sign-in">Sign in again</a>}</div>}
    {created ? <>
     <h2>{created.name}</h2>
     <ol className="setup-steps">
      <li><h3>Save your key.</h3><p>Copy this key now. It is shown only once. If you lose it, create a new key in Settings.</p>
       <div className="secret-key setup-key"><label htmlFor="setup-ingest-key">Ingest key</label><textarea id="setup-ingest-key" rows={2} readOnly value={created.ingestKey} spellCheck={false} autoComplete="off" /><button className="text-button" type="button" onClick={() => void copyKey()}>Copy ingest key</button><p role="status">{copied ? 'Key copied.' : ''}</p></div>
      </li>
      <li><h3>Send a test error.</h3><SendTestError project={created.id} ingestKey={created.ingestKey} release={release} build={build} request={api} onSendingChange={setSendingTest} /></li>
      <li><h3>Give this code to your developer.</h3><LocalCaptureNote endpoint={endpoint} />
       <OriginStep showDetails={false} project={created.id} request={api} />
       <div className="setup-release"><Field label="Release" value={release} required pattern="[a-zA-Z0-9._:@+\-]+" onChange={event => setRelease(event.target.value)} /><Field label="Build" value={build} required pattern="[a-zA-Z0-9._:\-]+" onChange={event => setBuild(event.target.value)} /></div>
       {endpoint && <SdkSetup endpoint={endpoint} project={created.id} ingestKey={created.ingestKey} release={release} build={build} />}
       <details><summary>Details</summary>{created.devMinted && <p>This key works only with this local copy of Spool. After putting Spool online, sign in there and create a new key for your app.</p>}<SentryIntake dsn={created.dsn} /></details>
      </li>
     </ol>
     {sendingTest ? <button className="primary-button setup-continue" type="button" disabled>Waiting for test result…</button> : <a className="primary-button setup-continue" href="/">Continue to workbench</a>}
    </> : restoring ? <>
     <ArchiveSettings busy={busy || !ready} empty run={run} refresh={() => location.assign('/')} allowDownload={false} />
     <button className="text-button setup-alternative" disabled={busy} onClick={() => { setRestoring(false); setError(''); }}>Create a project instead</button>
    </> : <>
     <h2>One project per application</h2><p>Choose a stable identifier such as <code className="mark">web-app</code> and a name you will recognize. You can create more projects later.</p>
     <ProjectForm request={api} run={run} busy={busy} disabled={!ready || !identity.ready} beforeCreate={identity.initialize} onCreated={setCreated}><SetupIdentity value={identity.value} onChange={identity.setValue} disabled={busy || !ready || !identity.ready} /></ProjectForm>
     <p className="setup-note">The next step shows your ingest key once, with the SDK setup for your application.</p>
     <div className="setup-alternative"><p>Moving from another Spool? Restore before creating a project.</p><button className="text-button" disabled={busy || !ready} onClick={() => { setRestoring(true); setError(''); }}>Restore a private archive</button></div>
     <noscript><p>Project creation needs JavaScript. Enable it and reload this page to continue.</p></noscript>
    </>}
   </div>
  </section>
 </main>;
}
