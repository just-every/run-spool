import { useEffect, useState, type FormEvent } from 'react';
import { captureException } from '../../domain/capture';
import { receiptLabel } from './CaptureReceipts';
import { hrefFor } from './location';
import type { Request } from './shared';
import './sdk.css';

// Spool's own SDK is the way in; an existing Sentry SDK pointed at the project DSN is the secondary path.
export const sdkPackage = '@just-every/spool';
export const installCommand = `npm install ${sdkPackage}`;
export function initSnippet({ endpoint, project, ingestKey, release, build }: { endpoint: string; project: string; ingestKey: string; release: string; build: string }) {
  const q = JSON.stringify;
  return `import { init } from '${sdkPackage}';\ninit({ endpoint: ${q(endpoint)}, project: ${q(project)}, ingestKey: ${q(ingestKey)},\n  release: ${q(release)}, build: ${q(build)} });`;
}

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState('');
  return <div className="code-block"><pre aria-label={label}>{code}</pre><button className="text-button" type="button" aria-label={`Copy ${label}`} onClick={() => void navigator.clipboard.writeText(code).then(() => setCopied('Copied.'), () => setCopied('Copy is unavailable here. Select the text instead.'))}>Copy</button><span role="status" className="muted">{copied}</span></div>;
}

export function SdkSetup({ endpoint, project, ingestKey, release, build }: { endpoint: string; project: string; ingestKey: string; release: string; build: string }) {
  return <div className="sdk-setup">
    <h3>Install the Spool SDK</h3>
    <CodeBlock label="Install command" code={installCommand} />
    <h3>Initialise it once in your app</h3>
    <CodeBlock label="SDK init" code={initSnippet({ endpoint, project, ingestKey, release, build })} />
    <p className="muted">It captures uncaught errors and unhandled rejections in the browser. On Node import <code>{sdkPackage}/node</code>; in Cloudflare Workers call <code>captureException</code> from <code>{sdkPackage}/worker</code> with your handler’s <code>ctx</code>. For original-source stacks, use the complete <a className="inline-link" href={`${hrefFor(project, 'releases')}#source-map-setup`}>source-map setup</a> with your project’s build key and bundler configuration.</p>
  </div>;
}

/**
 * The browser init sends from the app's own origin, which Spool refuses until the project allows it. The step is
 * tied to this project and lists what is already allowed; the app's origin itself is not known here, so the field
 * starts empty.
 */
export function OriginStep({ project, request }: { project: string; request: Request }) {
  const [origin, setOrigin] = useState(''), [allowed, setAllowed] = useState<string[] | null>(null), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const path = `/api/projects/${encodeURIComponent(project)}/browser-origins`;
  useEffect(() => {
    let alive = true;
    request(path).then(rows => { if (alive) setAllowed(rows.map((row: any) => row.origin)); }, () => { if (alive) setAllowed(null); });
    return () => { alive = false; };
  }, [path, request]);
  async function allow(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const result = await request(path, 'POST', { origin });
      setStatus(result.implicit ? `${result.origin} is Spool’s own origin and is always allowed.` : `Allowed ${result.origin}.`);
      if (!result.implicit) setAllowed(rows => [...new Set([...(rows ?? []), result.origin])]);
      setOrigin('');
    } catch (failure) { setStatus(`Not allowed: ${(failure as Error).message}`); }
    finally { setBusy(false); }
  }
  return <div className="origin-step">
    <h3>Allow your app’s origin</h3>
    <p className="muted">In a browser, Spool accepts events only from origins this project allows, so the init above sends nothing until your app’s exact origin is allowed. Node and Workers send no origin and need only the key.</p>
    <form className="origin-form" onSubmit={event => void allow(event)}>
      <label className="form-field">Your app’s origin<input type="url" required maxLength={1024} placeholder="https://app.example" value={origin} disabled={busy} aria-describedby="origin-step-help" onChange={event => { setOrigin(event.target.value); setStatus(''); }} /></label>
      <button className="primary-button" disabled={busy || !origin}>Allow origin</button>
    </form>
    <p id="origin-step-help" className="muted">Scheme, host and port only, such as <code>http://localhost:5173</code>. {allowed === null ? null : allowed.length ? <>Allowed now: {allowed.map((row, index) => <span key={row}>{index ? ', ' : ''}<code>{row}</code></span>)}.</> : 'No app origin is allowed yet.'} <a className="inline-link" href={hrefFor(project, 'capture')}>Manage allowed origins</a></p>
    <p role="status">{status}</p>
  </div>;
}

export function SentryIntake({ dsn }: { dsn?: string }) {
  return <div className="sentry-intake">
    <h3>Already using Sentry? Point your DSN here</h3>
    <p>Keep your Sentry browser or Node SDK and replace only its DSN. Register its release and dist as a Spool release and build (build <code>sentry-no-dist</code> when it sets no dist). Spool keeps exceptions and stack traces, not sessions, traces or replays.</p>
    {dsn ? <CodeBlock label="Sentry DSN" code={dsn} /> : <p>Its DSN is shown once, next to each new ingest key created under Project keys in Settings.</p>}
  </div>;
}

/** Registers the release if it is new, then sends one real exception through the same capture code the SDK ships. */
export function SendTestError({ project, ingestKey, release, build, request }: { project: string; ingestKey: string; release: string; build: string; request: Request }) {
  const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState<any>(null), [failure, setFailure] = useState('');
  async function send() {
    setBusy(true); setOutcome(null); setFailure('');
    try {
      await request(`/api/projects/${encodeURIComponent(project)}/releases`, 'POST', { name: release, build });
      let exception: Error;
      try { const order: any = {}; order.customer.email; throw new Error('Unexpected test result'); } catch (error) { exception = error as Error; }
      setOutcome(await captureException(exception, { endpoint: location.origin, project, ingestKey, release, build, environment: 'spool-test', credentials: 'same-origin' }));
    } catch (error) { setFailure((error as Error).message || 'The release could not be registered.'); }
    finally { setBusy(false); }
  }
  return <div className="send-test">
    <button className="primary-button" type="button" disabled={busy || !ingestKey} onClick={() => void send()}>{busy ? 'Sending…' : 'Send test error'}</button>
    <p className="muted">Registers release <code>{release}</code> build <code>{build}</code> if it is new, then sends one error with this key from this page. It checks the key and release, not your app’s browser origin.</p>
    <p role="status">{failure ? `Not sent: ${failure}` : !outcome ? '' : outcome.outcome === 'accepted' || outcome.outcome === 'duplicate' ? 'Test error received.' : `Not received: ${outcome.reason ? receiptLabel(outcome.reason) : outcome.outcome}.`}</p>
    {outcome?.issue && <a className="inline-link" href={hrefFor(project, 'issues', outcome.issue)}>Open the test issue</a>}
  </div>;
}
