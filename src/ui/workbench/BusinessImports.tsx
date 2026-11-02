import { useRef, useState } from 'react';
import { useLiveRead } from './useLiveRead';
import { Details } from './Details';
import type { Request, Run } from './shared';

type BusinessImportState = {
  configured: boolean;
  enabled: boolean;
  keys: { kid: string; revoked: boolean }[];
  history: { planId: string; jobId: string; namespace: string; fingerprint: string; state: string; caption: string }[];
};

export function BusinessImports({ request, run, busy }: { request: Request; run: Run; busy: boolean }) {
  const [state, setState] = useState<BusinessImportState | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState('');
  const stateLoaded = useRef(false); stateLoaded.current = state !== null;
  const path = '/api/imports/business';
  const disabled = busy || pending;

  // Read quietly while the tab is visible; a read that began before an action never replaces what the action showed.
  const generation = useRef(0);
  async function load() { setState(await request(path)); }
  useLiveRead(async signal => {
    const started = generation.current;
    try {
      const next = await request(path);
      if (signal.aborted || started !== generation.current) return;
      setState(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    } catch (error) { if (!signal.aborted && !stateLoaded.current) setProblem((error as Error).message); }
  }, [request]);
  function perform(work: () => Promise<unknown>) {
    return run(async () => {
      setPending(true); setProblem(''); generation.current++;
      try { await work(); }
      catch (error) { setProblem((error as Error).message); throw error; }
      finally { generation.current++; setPending(false); }
    });
  }

  return <section className="evidence"><div className="data-row">
    <strong>Business imports</strong>
    <span>{state ? state.enabled ? 'Enabled' : 'Off' : 'Off by default'}</span>
    <Details title="Business imports">
      <p>Enable imports from trusted business keys. Imports are off by default.</p>
      {problem && <p role="alert">{problem}</p>}
      {pending && <p role="status">Working…</p>}
      {state && <>
        {!state.configured && <p>Owner-claim trust configuration is required before enabling business imports.</p>}
        <button className="text-button" disabled={disabled || (!state.configured && !state.enabled)} onClick={() => void perform(async () => {
          setState(await request(path, 'POST', { enabled: !state.enabled }));
        })}>{state.enabled ? 'Disable business imports' : 'Enable business imports'}</button>
        <h3>Trusted keys</h3>
        {!state.keys.length && <p>No trusted business keys configured.</p>}
        {state.keys.map(key => <div className="data-row" key={key.kid}>
          <code>{key.kid}</code><span>{key.revoked ? 'Revoked' : 'Trusted'}</span>
          {!key.revoked && <button className="text-button" disabled={disabled} aria-label={`Revoke trusted key ${key.kid}`} onClick={() => void perform(async () => {
            setState(await request(path, 'POST', { enabled: state.enabled, revokedKids: [...state.keys.filter(row => row.revoked).map(row => row.kid), key.kid] }));
          })}>Revoke key</button>}
        </div>)}
        <h3>Import history</h3>
        {!state.history.length && <p>No business imports yet.</p>}
        {state.history.map(job => <div className="data-row" key={job.jobId}>
          <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><p>{job.caption}</p><p><code>{job.namespace}</code></p></div>
          <span>{job.state}</span>
          {(job.state === 'completed' || job.state === 'undoing') && <button className="text-button" disabled={disabled} aria-label={`Undo import ${job.caption}`} onClick={() => void perform(async () => {
            await request(`${path}/${encodeURIComponent(job.planId)}/undo`, 'POST');
            await load();
          })}>Undo</button>}
        </div>)}
        {state.history.some(job => job.state === 'undoing') && <p>Undo is in progress. Click Undo again to continue.</p>}
      </>}
    </Details>
  </div></section>;
}
