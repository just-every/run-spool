import { useEffect, useRef, useState } from 'react';
import { Field, type Request, type Run } from './shared';
import { SaveState } from './SaveState';
import { useSaveState } from './useAutoPreview';
import type { LoaderOptions } from '../../domain/loader/options';

export function LoaderSettings({ project, keyHash, request, run, busy }: { project: string; keyHash: string; request: Request; run: Run; busy: boolean }) {
 const [snapshot, setSnapshot] = useState<{ revision: number; settings: LoaderOptions; versions: string[] } | null>(null);
 const [publicKey, setPublicKey] = useState(''), [endpoint, setEndpoint] = useState(''), [matches, setMatches] = useState(false);
 const { state, save } = useSaveState(), timer = useRef(0), revision = useRef(0);
 const path = `/api/projects/${project}/keys/${keyHash}/loader`;
 useEffect(() => { setEndpoint(location.origin); void run(async () => { const value = await request(path); revision.current = value.revision; setSnapshot(value); }); }, [path]);
 useEffect(() => { let active = true; setMatches(false); if (/^[a-f0-9]{64}$/.test(publicKey)) void crypto.subtle.digest('SHA-256', new TextEncoder().encode(publicKey)).then(bytes => { if (active) setMatches([...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('') === keyHash); }); return () => { active = false; }; }, [publicKey, keyHash]);
 if (!snapshot) return <p>Loading browser loader settings…</p>;
 // Settings save as they change; a rate saves once it is a number from 0 to 1.
 const change = (name: keyof LoaderOptions, value: string | number | boolean) => {
  const settings = { ...snapshot.settings, [name]: value };
  setSnapshot({ ...snapshot, settings }); window.clearTimeout(timer.current);
  if (typeof value === 'number' && !(value >= 0 && value <= 1)) return;
  timer.current = window.setTimeout(() => void save(async () => { const result = await request(path, 'PUT', { revision: revision.current, settings }); revision.current = result.revision; setSnapshot(current => current && { ...current, ...result, settings: current.settings }); }), 400);
 };
 return <section aria-label="Browser loader settings"><h3>Browser loader</h3><p>The loader ships this installation’s official Sentry browser SDK. Tracing, replay and feedback are off until you enable them. Settings take effect on the next script load.</p>
  <form className="form-grid" onSubmit={event => event.preventDefault()}>
   <label className="form-field">Loader SDK version<select value={snapshot.settings.sdkVersion} onChange={event => change('sdkVersion', event.target.value)}>{snapshot.versions.map(version => <option key={version}>{version}</option>)}</select></label>
   <label><input type="checkbox" checked={snapshot.settings.enabled} onChange={event => change('enabled', event.target.checked)} /> Serve this key’s loader</label>
   {([['tracesSampleRate', 'Tracing sample rate'], ['replaysSessionSampleRate', 'Replay session sample rate'], ['replaysOnErrorSampleRate', 'Replay error sample rate']] as const).map(([name, label]) => <Field key={name} label={label} type="number" min="0" max="1" step="any" required value={snapshot.settings[name]} onChange={event => change(name, Number(event.target.value))} />)}
   <label><input type="checkbox" checked={snapshot.settings.feedback} onChange={event => change('feedback', event.target.checked)} /> Enable feedback widget</label>
   <p className="muted">Rates range from 0 (off) to 1 (all). Optional features load the SDK immediately. Spool counts unsupported telemetry without storing it.</p>
   <SaveState state={state} />
  </form>
  <Field label="Public capture key for script tag" value={publicKey} autoComplete="off" onChange={event => setPublicKey(event.target.value.trim())} />
  {publicKey && !matches && <p role="status">Paste the public capture key that matches this key record.</p>}
  <p>Keys are shown once. Paste this key from your site’s DSN to fill the tag; this field is never saved.</p>
  <pre><code>{`<script src="${endpoint}/sdk/${matches ? publicKey : 'YOUR_INGEST_KEY'}.min.js" crossorigin="anonymous"></script>`}</code></pre>
  <p>The default loader waits for a capture call or an uncaught error. Use <code>data-lazy="no"</code> to load immediately. Register <code>Sentry.onLoad(callback)</code> after the tag or define <code>window.sentryOnLoad</code> before it. Callbacks see an initialized client; use <code>Sentry.init</code> there to add your release and dist.</p>
 </section>;
}
