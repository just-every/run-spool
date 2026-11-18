import { LocalCaptureNote } from './localEndpoint';
import { useEffect, useState } from 'react';
import { BrowserOrigins } from '../BrowserOrigins';
import { sendTestSample, testResult, testResultLabel } from './testSample';
import { Details } from './Details';
import { CaptureReceipts, requiresRelease, receiptLabel } from './CaptureReceipts';
import { hrefFor } from './location';
import { Field, useDraft, type Request, type Run } from './shared';
import { captureStatus, type CaptureOutcomes } from './captureStatus';
import { SdkSetup, SentryIntake } from './SdkSetup';
import { ClientKeySetup } from './ClientKeySetup';
import { SourceMapSetup } from './SourceMapSetup';
export function CaptureView({ project, projectName, releases, issues, outcomes, busy, request, run, refresh, onReleases, onIssue, readOnly = false, manageProject = true, manageOrganization = true, initialKey = '', initialDsn, onKeyDismiss }: {
  onKeyDismiss?: () => void; initialKey?: string; initialDsn?: string; project: string; projectName: string; releases: any[]; issues: any[]; outcomes: CaptureOutcomes | null; busy: boolean; request: Request; run: Run; refresh: () => void; onReleases: () => void; onIssue: (id: string) => void; readOnly?: boolean; manageProject?: boolean; manageOrganization?: boolean;
}) {
  const [endpoint, setEndpoint] = useState('');
  const [key, setKey] = useDraft(`${project}.capture-key`, initialKey), [releaseName, setReleaseName] = useDraft(`${project}.capture-release`, '');
  const [preview, setPreview] = useDraft<any>(`${project}.capture-preview`, null), [outcome, setOutcome] = useDraft<any>(`${project}.capture-outcome`, null);
  const [lastCapture, setLastCapture] = useDraft<any>(`${project}.capture-retry`, null);
  const release = releases.find(row => row.name === releaseName) ?? releases[0];
  const status = captureStatus(outcomes, issues);
  useEffect(() => { setEndpoint(location.origin); }, []);
  if (readOnly) return <>
    <section className="evidence capture-progress"><h2>{status.title}</h2><p role="status">{status.detail}</p>{issues[0] && <button className="primary-button" onClick={() => onIssue(issues[0].id)}>Open latest issue</button>}</section>
    <section className="evidence capture-accounting"><CaptureReceipts project={project} outcomes={outcomes} /></section>
    <section className="evidence"><h2>Registered releases</h2>{releases.length ? <ul>{releases.map(row => <li key={row.name}>{row.name} · {row.build}</li>)}</ul> : <p>No releases recorded.</p>}<button className="text-button" onClick={onReleases}>View releases</button></section>
  </>;
  return <>
    <section className="evidence capture-progress"><h2>{status.title}</h2><p role="status">{status.detail}</p>{issues[0] && <button className="primary-button" onClick={() => onIssue(issues[0].id)}>Open latest issue</button>}</section>
    <section className="evidence capture-accounting"><CaptureReceipts project={project} outcomes={outcomes} /></section>
    <section className="evidence"><h2>1. Choose a release</h2><label className="form-field">Registered release<select value={release?.name ?? ''} onChange={e => setReleaseName(e.target.value)}><option value="">Choose a release</option>{releases.map(row => <option key={row.name}>{row.name}</option>)}</select></label><button className="text-button" onClick={onReleases}>{releases.length ? 'Manage releases and maps' : 'Register your first release'}</button></section>
    {manageProject && <BrowserOrigins step={2} key={project} project={project} busy={busy} request={request} run={run} />}
    <section className="evidence"><h2>{manageProject ? '3.' : '2.'} Connect your application</h2>
      <LocalCaptureNote endpoint={endpoint} />
      {endpoint && manageProject ? <ClientKeySetup onReceived={refresh} key={project} {...{ project, endpoint, request, run, busy, initialKey, initialDsn }} release={release?.name ?? '1.0.0'} build={release?.build ?? 'local'} onIssued={value => { setKey(value); if (!value) onKeyDismiss?.(); }} /> : endpoint ? <><p>Ask a project maintainer, organization administrator or installation owner to create an ingest key in Settings → Projects &amp; keys and share it privately. Use that key in your application; saved keys cannot be recovered.</p><SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={release?.name ?? 'REGISTERED_RELEASE'} build={release?.build ?? 'REGISTERED_BUILD'} /><SentryIntake /></> : <p>Preparing your service endpoint…</p>}
    </section>
    <section id="test-capture" className="evidence"><h2>{manageProject ? '4.' : '3.'} Verify capture</h2><form className="form-grid" onSubmit={e => { e.preventDefault(); void run(async () => {
      setOutcome(null);
      const sampleRelease=release??{name:'1.0.0',build:'local'};
      try { await request(`/api/projects/${encodeURIComponent(project)}/releases`,'POST',{name:sampleRelease.name,build:sampleRelease.build}); }
      catch { setOutcome({outcome:'not_sent',reason:'unregistered_release_or_build'});return; }
      const received=await sendTestSample({endpoint,project,ingestKey:key,release:sampleRelease.name,build:sampleRelease.build,environment:'spool-test',credentials:'same-origin',onPreview:event=>{setPreview(event);setLastCapture({project,key,event})}});
      setOutcome(await testResult(request,project,received));refresh();
    }); }}><Field label="Project ingest key" type="password" autoComplete="off" required value={key} onChange={e=>setKey(e.target.value)}/><button className="primary-button" disabled={busy}>Send the test error again</button></form>
      <p>Sends Spool’s sample error with this key, registering release {release?.name??'1.0.0'} first, so you can expect a new test issue, another event on the same issue, or a regression if you resolved it.</p>
      {outcome&&<>
        <p role="status">{outcome.reason==='invalid_ingest_key'?<>That key isn’t valid for {projectName}. Paste the key you saved, or <a className="inline-link" href={hrefFor(project,'settings')+'#settings-projects'}>Create a new key</a>.</>:requiresRelease(outcome.reason)?<>Register a release first. <a className="inline-link" href={hrefFor(project,'releases')}>Go to release registration</a>.</>:outcome.outcome==='accepted'?testResultLabel(outcome):outcome.outcome==='duplicate'?'This test event was already received.':`Test error not confirmed: ${outcome.reason?receiptLabel(outcome.reason):'check your connection and key'}.`}</p>
        {outcome.issue&&<button className="text-button" onClick={()=>onIssue(outcome.issue)}>Open captured issue</button>}
        {lastCapture&&outcome.outcome==='unknown'&&outcome.reason==='transport_failure'&&<button className="text-button" disabled={busy} onClick={()=>void run(async()=>{const response=await fetch(`/api/ingest/${encodeURIComponent(lastCapture.project)}`,{method:'POST',credentials:'same-origin',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:`Bearer ${lastCapture.key}`},body:JSON.stringify(lastCapture.event)});if(response.status===0||(response.status>=300&&response.status<400))throw new Error('Capture redirect refused.');setOutcome(await testResult(request,project,await response.json()));refresh()})}>Retry exact event</button>}
        <Details title="Capture result"><pre>{JSON.stringify({outcome,outbound:preview},null,2)}</pre></Details>
      </>}
    </section>
    {manageOrganization && <SourceMapSetup {...{ project, releases, request, run, busy, refresh }} />}
  </>;
}
