import {useEffect, useRef, useState} from 'react';
import type {Request, Run} from './shared';
import {ScrubbingRuleRow, type ScrubbingPolicy, type ScrubbingRule} from './ScrubbingRuleRow';
import {ScrubbingPreview, type ScrubbingPreviewResult} from './ScrubbingPreview';

type Scope = 'project' | 'installation';
type Props = {project: string; request: Request; run: Run; busy: boolean};
type Current = {
  revision: number; policy: ScrubbingPolicy;
  installationRevision: number; installationPolicy: ScrubbingPolicy;
};
type Draft = {sensitive: string; safe: string; rules: ScrubbingRule[]};
type Preview = {result: ScrubbingPreviewResult; draft: string};

function draftOf(policy: ScrubbingPolicy): Draft {
  return {sensitive: policy.sensitiveFields.join('\n'), safe: policy.safeFields.join('\n'), rules: policy.rules.map(rule => ({...rule}))};
}
function policyOf(draft: Draft): ScrubbingPolicy {
  const lines = (text: string) => text.split('\n').map(line => line.trim()).filter(Boolean);
  return {version: 1, sensitiveFields: lines(draft.sensitive), safeFields: lines(draft.safe), rules: draft.rules};
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'The scrubbing request failed. Try again.';
}

export function ScrubbingRules({project, request, run, busy}: Props) {
  const [scope, setScope] = useState<Scope>('project');
  const root = scope === 'installation' ? '/api/scrubbing' : `/api/projects/${encodeURIComponent(project)}/scrubbing`;
  return <section className="evidence" aria-label="Server scrubbing">
    <h2>Server scrubbing rules</h2>
    <p>Default scrubbers stay active. Save additional rules for later intake; retained evidence stays unchanged.</p>
    <p>Installation rules protect every project. Project rules and safe fields cannot weaken the installation policy. Safe fields never disable the default scrubbers.</p>
    <label className="form-field">Rule scope
      <select aria-label="Rule scope" value={scope} disabled={busy} onChange={event => setScope(event.target.value as Scope)}>
        <option value="project">Project</option><option value="installation">Installation</option>
      </select>
    </label>
    <ScrubbingEditor key={root} {...{root, scope, request, run, busy}}/>
  </section>;
}

function ScrubbingEditor({root, scope, request, run, busy}: {
  root: string; scope: Scope; request: Request; run: Run; busy: boolean;
}) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const generation = useRef(0), live = useRef(true);
  const disabled = busy || pending;

  useEffect(() => {
    live.current = true;
    request(root).then((value: Current) => {
      if (!live.current) return;
      setCurrent(value); setDraft(draftOf(value.policy)); setError('');
    }).catch(error => { if (live.current) setError(message(error)); });
    return () => { live.current = false; generation.current++; };
  }, [root, request]);

  const action = (work: () => Promise<void>) => {
    if (pending) return;
    setPending(true); setError('');
    void run(async () => {
      try { await work(); }
      catch (error) {
        if (live.current) { setError(message(error)); setStatus('Your draft is preserved. Preview again after correcting the issue.'); }
      } finally { if (live.current) setPending(false); }
    });
  };
  const change = (next: Draft) => {
    generation.current++; setDraft(next); setPreview(null); setError('');
    setStatus('Unsaved changes. Preview scrubbing before saving.');
  };
  const previewPolicy = () => {
    if (!draft || !current) return;
    const snapshot = JSON.stringify(draft), version = generation.current;
    action(async () => {
      setPreview(null); setStatus('Previewing scrubbing…');
      const result: ScrubbingPreviewResult = await request(root + '/preview', 'POST', {policy: policyOf(draft)});
      if (!live.current || version !== generation.current) return;
      setPreview({result, draft: snapshot});
      if (result.revision !== current.revision || result.installationRevision !== current.installationRevision) {
        setCurrent({...current, revision: result.revision, installationRevision: result.installationRevision});
      }
      setStatus(result.refusal ? 'Preview refused. Correct the draft and preview again.' : result.token
        ? 'Preview ready. Review the masked sample, match counts and revisions before saving.'
        : 'Preview has no save token. Preview again before saving.');
    });
  };
  const savePolicy = () => {
    if (!draft || !current || !preview?.result.token || preview.result.refusal || preview.draft !== JSON.stringify(draft)) return;
    action(async () => {
      const approved = preview.result;
      setPreview(null);
      const value: Current = await request(root, 'PUT', {revision: approved.revision, policy: policyOf(draft), token: approved.token});
      if (!live.current) return;
      setCurrent({...current, ...value}); setDraft(draftOf(value.policy));
      setStatus(`Scrubbing rules saved at revision ${value.revision}. Later intake uses this policy.`);
    });
  };

  if (!draft || !current) return <>
    {error ? <><p role="alert">Scrubbing rules could not be loaded: {error}</p>
      <button className="text-button" disabled={disabled} onClick={() => action(async () => {
        const value: Current = await request(root);
        if (live.current) {setCurrent(value); setDraft(draftOf(value.policy)); setStatus('Scrubbing rules loaded.');}
      })}>Retry scrubbing rules</button></> : <p role="status">Loading scrubbing rules…</p>}
  </>;

  const canSave = preview?.result.token && !preview.result.refusal && preview.draft === JSON.stringify(draft);
  return <>
    <p>Active {scope} revision {current.revision} · Installation revision {current.installationRevision}.</p>
    {scope === 'installation' && <p>You are editing the owner’s installation policy for every project.</p>}
    {scope === 'project' && <div className="callout">
      <h3>Installation protection</h3>
      <p>{current.installationPolicy.rules.length} installation rules and {current.installationPolicy.sensitiveFields.length} additional sensitive fields apply before project policy.</p>
      {!!current.installationPolicy.sensitiveFields.length && <p style={{overflowWrap: 'anywhere'}}>Sensitive fields: {current.installationPolicy.sensitiveFields.join(', ')}.</p>}
      {!!current.installationPolicy.rules.length && <ul style={{overflowWrap: 'anywhere'}}>{current.installationPolicy.rules.map(rule =>
        <li key={rule.id}><code>{rule.selector}</code> · {rule.pattern.replaceAll('_', ' ')} · {rule.method}</li>
      )}</ul>}
    </div>}
    <div className="form-grid">
      <label className="form-field">Additional sensitive fields
        <textarea aria-label="Additional sensitive fields" rows={3} disabled={disabled} value={draft.sensitive}
          onChange={event => change({...draft, sensitive: event.target.value})}/>
      </label>
      <label className="form-field">Safe fields
        <textarea aria-label="Safe fields" rows={3} disabled={disabled} value={draft.safe}
          onChange={event => change({...draft, safe: event.target.value})}/>
      </label>
    </div>
    <p>Enter one field selector per line. Safe fields are exceptions within this scope; installation protection and default scrubbers still apply.</p>
    <h3>Custom scrubbing rules</h3>
    {!draft.rules.length && <p>No custom rules in this scope.</p>}
    {draft.rules.map((rule, index) => <ScrubbingRuleRow key={rule.id} {...{rule, index}} disabled={disabled}
      onChange={next => change({...draft, rules: draft.rules.map(value => value.id === rule.id ? next : value)})}
      onRemove={() => change({...draft, rules: draft.rules.filter(value => value.id !== rule.id)})}/>)}
    <div className="button-row">
      <button className="text-button" disabled={disabled} onClick={() => change({...draft, rules: [...draft.rules,
        {id: crypto.randomUUID(), selector: '', pattern: 'email', method: 'mask'},
      ]})}>Add scrubbing rule</button>
      <button className="text-button" disabled={disabled} onClick={previewPolicy}>Preview scrubbing</button>
      <button className="primary-button" disabled={disabled || !canSave} onClick={savePolicy}>Save scrubbing rules</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
    {preview && <ScrubbingPreview preview={preview.result} scope={scope}/>}
  </>;
}
