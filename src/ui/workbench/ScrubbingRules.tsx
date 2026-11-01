import './scrubbing.css';
import {useDraft} from './shared';
import {ScrubbingRefusal,refusalMessage,type RefusalTarget} from '../../domain/scrubbing/refusal';
import {scrubbingPolicy} from '../../domain/scrubbing/policy';
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
type Draft = {revision?:number; sensitive: string; safe: string; rules: ScrubbingRule[]};
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
  const [scope, setScope] = useDraft<Scope>(`${project}.scrubbing.scope`,'project');
  const root = scope === 'installation' ? '/api/scrubbing' : `/api/projects/${encodeURIComponent(project)}/scrubbing`;
  return <section className="evidence scrubbing-section" aria-label="Server scrubbing">
    <h2>Server scrubbing rules</h2>
    <label className="form-field">Rule scope
      <select aria-label="Rule scope" value={scope} disabled={busy} onChange={event => setScope(event.target.value as Scope)}>
        <option value="project">Project</option><option value="installation">Installation</option>
      </select>
    </label>
    <ScrubbingEditor key={root} {...{root, scope, request, run, busy}} draftKey={scope==='installation'?'scrubbing.installation':`${project}.scrubbing.project`}/>
  </section>;
}

function ScrubbingEditor({root, scope, request, run, busy, draftKey}: {
  root: string; draftKey:string; scope: Scope; request: Request; run: Run; busy: boolean;
}) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [keptDraft, setDraft] = useDraft<Draft | null>(draftKey,null);
  const draft=keptDraft??(current?{...draftOf(current.policy),revision:current.revision}:null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [refused,setRefused]=useState<{code:string;target?:RefusalTarget}|null>(null);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const generation = useRef(0), live = useRef(true);
  const disabled = busy || pending;

  useEffect(() => {
    live.current = true;
    request(root).then((value: Current) => {
      if (!live.current) return;
      setCurrent(value); setError('');
    }).catch(error => { if (live.current) setError(message(error)); });
    return () => { live.current = false; generation.current++; };
  }, [root, request]);

  const action = (work: () => Promise<void>) => {
    if (pending) return;
    setPending(true); setError('');
    void run(async () => {
      try { await work(); }
      catch (error) {
        if (live.current) { if(error instanceof ScrubbingRefusal)setRefused({code:error.message,target:error.target});else setError(message(error)); setStatus('Your draft is preserved. Preview again after correcting the issue.'); }
      } finally { if (live.current) setPending(false); }
    });
  };
  const change = (next: Draft) => {
    generation.current++; setDraft(next); setPreview(null); setError(''); setRefused(null);
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
      setRefused(result.refusal?{code:result.refusal,target:result.refusalTarget}:null);
      if (result.revision !== current.revision || result.installationRevision !== current.installationRevision) {
        setCurrent({...current, revision: result.revision, installationRevision: result.installationRevision});
      }
      setStatus(result.refusal ? '' : result.token
        ? 'Preview ready'
        : 'Preview has no save token. Preview again before saving.');
    });
  };
  const savePolicy = () => {
    if (!draft || !current || !preview?.result.token || preview.result.refusal || preview.draft !== JSON.stringify(draft)) return;
    action(async () => {
      scrubbingPolicy(policyOf(draft),scope==='project'?current.installationPolicy:undefined);
      const approved = preview.result;
      setPreview(null);
      const value: Current = await request(root, 'PUT', {revision: approved.revision, policy: policyOf(draft), token: approved.token});
      if (!live.current) return;
      setCurrent({...current, ...value}); setDraft(null);
      setStatus('Saved');
    });
  };

  if (!draft || !current) return <>
    {error ? <><p role="alert">Scrubbing rules could not be loaded: {error}</p>
      <button className="text-button" disabled={disabled} onClick={() => action(async () => {
        const value: Current = await request(root);
        if (live.current) {setCurrent(value); setDraft(null); setStatus('Scrubbing rules loaded.');}
      })}>Retry scrubbing rules</button></> : <p role="status">Loading scrubbing rules…</p>}
  </>;

  const canSave = preview?.result.token && !preview.result.refusal && preview.draft === JSON.stringify(draft);
  return <>
    {scope === 'project' && <div className="callout">
      <h3>Installation protection</h3>
      <p>Applies to every project before project rules.</p>
      {!!current.installationPolicy.sensitiveFields.length && <p style={{overflowWrap: 'anywhere'}}>Sensitive fields: {current.installationPolicy.sensitiveFields.join(', ')}.</p>}
      {!!current.installationPolicy.rules.length && <ul style={{overflowWrap: 'anywhere'}}>{current.installationPolicy.rules.map(rule =>
        <li key={rule.id}><code>{rule.selector}</code> · {rule.pattern.replaceAll('_', ' ')} · {rule.method}</li>
      )}</ul>}
    </div>}
    <div className="form-grid">
      <label className="form-field">Additional sensitive fields
        <textarea aria-label="Additional sensitive fields" rows={3} placeholder="$tags.tenant" disabled={disabled} value={draft.sensitive}
          onChange={event => change({...draft, sensitive: event.target.value})}/>
        {refused?.target?.kind==='sensitive'&&<span role="alert">{refusalMessage(refused.code,refused.target)}</span>}
      </label>
      <label className="form-field">Safe fields
        <textarea aria-label="Safe fields" rows={3} placeholder="$extra.order_id" disabled={disabled} value={draft.safe}
          onChange={event => change({...draft, safe: event.target.value})}/>
        {refused?.target?.kind==='safe'&&<span role="alert">{refusalMessage(refused.code,refused.target)}</span>}
      </label>
    </div>
    <h3>Custom scrubbing rules</h3>
    {!draft.rules.length && <p>No custom rules in this scope.</p>}
    {draft.rules.map((rule, index) => <ScrubbingRuleRow key={rule.id} {...{rule, index}} disabled={disabled} refusal={refused?.target?.kind==='rule'&&refused.target.ruleId===rule.id?refusalMessage(refused.code,refused.target):undefined}
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
    {(status || !preview && JSON.stringify(draftOf(current.policy))!==JSON.stringify({sensitive:draft.sensitive,safe:draft.safe,rules:draft.rules})) && <p role="status">{status || 'Unsaved changes. Preview scrubbing before saving.'}</p>}
    {preview && <ScrubbingPreview preview={preview.result} scope={scope}/>}
  </>;
}
