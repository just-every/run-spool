import { useEffect, useState } from 'react';
import { BrowserOrigins } from '../BrowserOrigins';
import { captureException } from '../../domain/capture';
import { Details } from './Details';
import { CaptureReceipts, requiresRelease, receiptLabel } from './CaptureReceipts';
import { hrefFor } from './location';
import { Field, useDraft, type Request, type Run } from './shared';
import { captureStatus, type CaptureOutcomes } from './captureStatus';
import { SdkSetup, SentryIntake } from './SdkSetup';
import { SourceMapSetup } from './SourceMapSetup';
export function CaptureView({ project, releases, issues, outcomes, busy, request, run, refresh, onReleases, onIssue, readOnly = false, manageProject = true, manageOrganization = true }: {
  project: string; releases: any[]; issues: any[]; outcomes: CaptureOutcomes | null; busy: boolean; request: Request; run: Run; refresh: () => void; onReleases: () => void; onIssue: (id: string) => void; readOnly?: boolean; manageProject?: boolean; manageOrganization?: boolean;
}) {
  const [endpoint, setEndpoint] = useState('');
  const [key, setKey] = useDraft(`${project}.capture-key`, ''), [releaseName, setReleaseName] = useDraft(`${project}.capture-release`, '');
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
    {manageProject && <BrowserOrigins key={project} project={project} busy={busy} request={request} run={run} />}
    <section className="evidence"><h2>{manageProject ? '3.' : '2.'} Connect your application</h2>
      {endpoint ? <SdkSetup endpoint={endpoint} project={project} ingestKey="YOUR_INGEST_KEY" release={release?.name ?? 'REGISTERED_RELEASE'} build={release?.build ?? 'REGISTERED_BUILD'} /> : <p>Preparing your service endpoint…</p>}
      <p className="muted">Use the ingest key shown when you created the project, or create one in <a className="inline-link" href={hrefFor(project, 'settings')}>Settings</a>. No bundler? Download <a className="inline-link" href="/errors-capture.js" download="errors-capture.js">the browser capture file</a> and call its <code>installBrowserCapture</code> with the same options.</p>
      <SentryIntake />
    </section>
    <section className="evidence"><h2>{manageProject ? '4.' : '3.'} Verify capture</h2><p>Trigger an error in your application; it will appear above. Or send a test from this browser.</p><form className="form-grid" onSubmit={e => { e.preventDefault(); void run(async () => {
      if (!release) throw new Error('Register a release first.');
      let exception: Error;
      try { const account: any = {}; account.address.city; throw new Error('Unexpected capture result'); } catch (error) { exception = error as Error; }
      setOutcome(await captureException(exception, { endpoint, project, ingestKey: key, release: release.name, build: release.build, environment: 'local-test', credentials: 'same-origin', onPreview: event => { setPreview(event); setLastCapture({ project, key, event }); } })); refresh();
    }); }}><Field label="Project ingest key" type="password" autoComplete="off" required value={key} onChange={e => setKey(e.target.value)} /><button className="primary-button" disabled={busy || !release}>Capture test exception</button></form>{outcome && <><p role="status">{outcome.outcome === 'accepted' ? 'Test event received.' : outcome.outcome === 'duplicate' ? 'This event was already received.' : `Capture ${outcome.outcome}: ${outcome.reason ? receiptLabel(outcome.reason) : 'check connection and credentials'}`}</p>{outcome.issue && <button className="text-button" onClick={() => onIssue(outcome.issue)}>Open captured issue</button>}{requiresRelease(outcome.reason) && <p><a className="inline-link" href={hrefFor(project, 'releases')}>Register the release and build</a>, then reproduce the error in your application.</p>}{lastCapture && !requiresRelease(outcome.reason) && <button className="text-button" disabled={busy} onClick={() => void run(async () => { const response = await fetch(`/api/ingest/${encodeURIComponent(lastCapture.project)}`, { method: 'POST', credentials: 'same-origin', redirect: 'manual', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lastCapture.key}` }, body: JSON.stringify(lastCapture.event) }); if (response.status === 0 || (response.status >= 300 && response.status < 400)) throw new Error('Capture redirect refused.'); setOutcome(await response.json()); refresh(); })}>Retry exact event</button>}<Details title="Capture result"><pre>{JSON.stringify({ outcome, outbound: preview }, null, 2)}</pre></Details></>}</section>
    {manageOrganization && <SourceMapSetup {...{ project, releases, request, run, busy, refresh }} />}
  </>;
}
