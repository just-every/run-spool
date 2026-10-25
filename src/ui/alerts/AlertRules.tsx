import {destinationLabel,ruleConfig,ruleSummary} from './RuleSummary';
import {RuleDecisions} from './RuleDecisions';
import { useRef, useState } from 'react';
import { alertApi, status } from './client';
import { Details } from '../workbench/Details';
import { Field, useDraft } from '../workbench/shared';
import { RulePreview, type Preview } from './RulePreview';

type Props = { project: string; rules: any[]; destinations: any[]; refresh: () => void };
type Metric = 'count' | 'users' | 'session_percent' | 'baseline';
type Draft = {
 editing: any; name: string; destination: string; kinds: string[]; enabled: boolean;
 windowMinutes: number; threshold: number; metric: Metric; environment: string; level: string;
 releaseMode: 'any' | 'none' | 'named'; release: string; tagKeys: string; tags: Record<string, string>;
};
const initial: Draft = {
 editing: null, name: '', destination: '', kinds: ['new_issue', 'regression'], enabled: true,
 windowMinutes: 5, threshold: 10, metric: 'count', environment: '', level: '',
 releaseMode: 'any', release: '', tagKeys: '', tags: {},
};
const metrics: Record<Metric, string> = {
 count: 'Accepted occurrences', users: 'Affected users', session_percent: 'Session error percentage', baseline: 'Historical baseline',
};
const keys = (value: string) => [...new Set(value.split(/[\n,]/).map(key => key.trim()).filter(Boolean))];
function configFor(draft: Draft) {
 const tagKeys = keys(draft.tagKeys), tags = Object.fromEntries(tagKeys.filter(key => Object.hasOwn(draft.tags, key) && draft.tags[key]).map(key => [key, draft.tags[key]]));
 return {
  metric: draft.metric,
  filters: {
   ...(draft.environment ? { environment: draft.environment } : {}),
   ...(draft.level ? { level: draft.level } : {}),
   ...(draft.releaseMode === 'none' ? { release: '' } : draft.releaseMode === 'named' ? { release: draft.release } : {}),
   ...(Object.keys(tags).length ? { tags } : {}),
  },
  tagKeys,
 };
}
export function AlertRules({ project, rules, destinations, refresh }: Props) {
 const [savedDraft, setDraft] = useDraft(`${project}.alert-rule`, initial);
 const draft = { ...initial, ...savedDraft };
 const { editing, name, destination, kinds, enabled, windowMinutes, threshold, metric, environment, level, releaseMode, release, tagKeys, tags } = draft;
 const [busy, setBusy] = useState<'save' | 'preview' | null>(null), [error, setError] = useState('');
 const [preview, setPreview] = useState<Preview | null>(null), version = useRef(0);
 const selected = destinations.find(d => d.id === destination), spike = kinds.includes('spike');
 const needsTest = (d: any) => d?.test?.state !== 'passing' || !d.test.reviewed_at;
 const allowedKeys = keys(tagKeys), config = configFor(draft);
 const filterLabels = [environment && `Environment: ${environment}`, level && `Severity: ${level}`,
  releaseMode !== 'any' && `Release: ${releaseMode === 'none' ? 'No release' : release}`,
  ...Object.entries(config.filters.tags ?? {}).map(([key, value]) => `${key}: ${value}`)].filter(Boolean);
 function change(update: Partial<Draft>) {
  version.current++; setPreview(null); setError(''); setDraft(previous => ({ ...initial, ...previous, ...update }));
 }
 function edit(rule: any) {
  const config = ruleConfig(rule), filters = config.filters ?? {};
  change({
   editing: rule, name: rule.name, destination: rule.destination, kinds: JSON.parse(rule.kinds), enabled: !!rule.enabled,
   windowMinutes: rule.window_ms / 60000, threshold: rule.threshold, metric: config.metric,
   environment: filters.environment ?? '', level: filters.level ?? '',
   releaseMode: filters.release === undefined ? 'any' : filters.release === '' ? 'none' : 'named',
   release: filters.release ?? '', tagKeys: (config.tagKeys ?? []).join(', '), tags: filters.tags ?? {},
  });
 }
 function clear() { change({ ...initial, kinds: [] }); }
 function payload() {
  return { name, enabled, channel: selected?.channel ?? editing?.channel, destination, kinds, windowMs: windowMinutes * 60000, threshold, config,
   ...(editing ? { revision: editing.revision } : {}) };
 }
 async function sample() {
  setBusy('preview'); setError(''); setPreview(null);
  const current = version.current;
  try {
   const result = await alertApi(`/api/projects/${project}/alerting/rules/preview`, 'POST', { ...payload(), ...(editing ? { ruleId: editing.id } : {}) });
   if (current === version.current) setPreview(result);
  } catch (e) { if (current === version.current) setError((e as Error).message); }
  finally { setBusy(null); }
 }
 async function save() {
  if (enabled && (!preview?.token || preview.refusal)) return;
  setBusy('save'); setError('');
  try {
   await alertApi(`/api/projects/${project}/alerting/rules${editing ? '/' + editing.id : ''}`, editing ? 'PUT' : 'POST', {
    ...payload(), ...(enabled ? { previewToken: preview!.token } : {}),
   });
   clear(); refresh();
  } catch (e) { setPreview(null); setError((e as Error).message); }
  finally { setBusy(null); }
 }
 const canSubmit = !!name.trim() && !!kinds.length && !!destination && (releaseMode !== 'named' || !!release);
 const thresholdLabel = metric === 'users' ? 'Affected user threshold (more than)' : metric === 'session_percent' ? 'Session error threshold (%)' : metric === 'baseline' ? 'Baseline multiplier' : 'Accepted occurrence threshold';
 return <section className="evidence alert-rules"><h2>Per-project rules</h2>
  {!destinations.length && <p className="callout">Add an email destination above before creating a rule.</p>}
  <ul className="alert-records">{rules.map(rule => <li key={rule.id}><div>
   <strong>{rule.name}</strong><p>{ruleSummary(rule,destinations.find(destination=>destination.id===rule.destination))}</p>
   {!rule.enabled && needsTest(destinations.find(d => d.id === rule.destination)) && <p className="callout">This destination needs a passing test and your review before this rule can be enabled.</p>}
   <Details title={`Rule ${rule.name}`}><p>{ruleSummary(rule,destinations.find(destination=>destination.id===rule.destination))}.</p></Details>
  </div><button className="text-button" disabled={!!busy} onClick={() => edit(rule)}>Edit {rule.name}</button></li>)}</ul>
  <RuleDecisions project={project} rules={rules}/><h3>{editing ? 'Edit rule' : 'Create rule'}</h3>
  <form className="form-grid" onSubmit={e => { e.preventDefault(); const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value'); void (action === 'preview' ? sample() : save()); }}>
   <Field label="Rule name" required maxLength={100} value={name} disabled={!!busy} onChange={e => change({ name: e.target.value })}/>
   <label className="form-field">Destination<select aria-label="Destination" required value={destination} disabled={!!busy} onChange={e => change({ destination: e.target.value })}>
    <option value="">Choose destination</option>
    {editing && !selected && destination && <option value={destination}>{destinationLabel(undefined)}</option>}
    {destinations.map(d => <option key={d.id} value={d.id}>{destinationLabel(d)}</option>)}
   </select></label>
   <fieldset><legend>Alert events</legend>{[['new_issue', 'New issue'], ['regression', 'Regression'], ['reactivation', 'Reactivation'], ['spike', 'Volume spike']].map(([kind, label]) => <label className="alert-check" key={kind}>
    <input type="checkbox" checked={kinds.includes(kind)} disabled={!!busy} onChange={e => change({ kinds: e.target.checked ? [...kinds, kind] : kinds.filter(k => k !== kind) })}/>{label}
   </label>)}</fieldset>
   {spike && <>
    <label className="form-field">Spike metric<select aria-label="Spike metric" value={metric} disabled={!!busy} onChange={e => change({ metric: e.target.value as Metric, threshold: e.target.value === 'session_percent' ? Math.min(threshold, 100) : threshold })}>
     {Object.entries(metrics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <Field label="Complete window (minutes)" type="number" required min={1} max={1440} value={windowMinutes} disabled={!!busy} onChange={e => change({ windowMinutes: Number(e.target.value) })}/>
    <Field label={thresholdLabel} type="number" required min={2} max={metric === 'session_percent' ? 100 : 10000} value={threshold} disabled={!!busy} onChange={e => change({ threshold: Number(e.target.value) })}/>

   </>}
   <details className="form-more"><summary>Filters{filterLabels.length ? ` (${filterLabels.length})` : ''}</summary><div className="form-grid">
    <Field label="Environment" maxLength={100} value={environment} disabled={!!busy} placeholder="Any environment" onChange={e => change({ environment: e.target.value })}/>
    <label className="form-field">Severity<select aria-label="Severity" value={level} disabled={!!busy} onChange={e => change({ level: e.target.value })}>
     <option value="">Any severity</option>{['debug', 'info', 'warning', 'error', 'fatal', 'log'].map(value => <option key={value} value={value}>{status(value)}</option>)}
    </select></label>
    <label className="form-field">Release filter<select aria-label="Release filter" value={releaseMode} disabled={!!busy} onChange={e => change({ releaseMode: e.target.value as Draft['releaseMode'] })}>
     <option value="any">Any release</option><option value="none">No release</option><option value="named">Specific release</option>
    </select></label>
    {releaseMode === 'named' && <Field label="Release name" required value={release} disabled={!!busy} onChange={e => change({ release: e.target.value })}/>}
    <Field label="Allowed tag keys" value={tagKeys} disabled={!!busy} placeholder="tenant, region" onChange={e => change({ tagKeys: e.target.value })}/>
    {allowedKeys.map(key => <Field key={key} label={`Tag ${key}`} value={Object.hasOwn(tags, key) ? tags[key] : ''} disabled={!!busy} placeholder="Any value" onChange={e => change({ tags: { ...tags, [key]: e.target.value } })}/>)}
   </div></details>
   {filterLabels.length > 0 && <p aria-label="Applied rule filters">{filterLabels.map(label => <span className="state-chip" style={{ whiteSpace: 'normal', overflowWrap: 'anywhere', margin: '0 8px 8px 0' }} key={String(label)}>{label}</span>)}</p>}
   <label className="alert-check"><input type="checkbox" checked={enabled} disabled={!!busy} onChange={e => change({ enabled: e.target.checked })}/>Enabled</label>
   {selected && needsTest(selected) && <p className="callout">Test this destination and review its passing result before enabling.</p>}
   {preview && <RulePreview preview={preview} project={project} destinations={destinations}/>}
   <div className="button-row" style={{ gridColumn: '1 / -1', flexWrap: 'wrap' }}>
    <button type="submit" value="preview" className="text-button" disabled={!!busy || !canSubmit}>{busy === 'preview' ? 'Previewing…' : 'Preview rule'}</button>
    <button type="submit" value="save" className="primary-button" disabled={!!busy || !canSubmit || enabled && (!preview?.token || !!preview.refusal)}>{busy === 'save' ? 'Saving…' : editing ? 'Save rule' : 'Create rule'}</button>
    {editing && <button type="button" className="text-button" disabled={!!busy} onClick={() => { if (window.confirm('Discard the unsaved rule changes?')) clear(); }}>Discard edit</button>}
   </div>
  </form>
  {error && <p role="alert" className="callout">{error}</p>}
 </section>;
}
