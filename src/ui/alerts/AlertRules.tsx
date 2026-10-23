import { useState } from 'react';
import { alertApi, status } from './client';
import { Details } from '../workbench/Details';
import { Field, useDraft } from '../workbench/shared';
type Props={project:string;rules:any[];destinations:any[];refresh:()=>void};
export function AlertRules({project,rules,destinations,refresh}:Props) {
 const [draft,setDraft]=useDraft(`${project}.alert-rule`,{editing:null as any,name:'',destination:'',kinds:['new_issue','regression'],enabled:true,windowMinutes:5,threshold:10});
 const {editing,name,destination,kinds,enabled,windowMinutes,threshold}=draft;
 const setEditing=(editing:any)=>setDraft(d=>({...d,editing})),setName=(name:string)=>setDraft(d=>({...d,name})),setDestination=(destination:string)=>setDraft(d=>({...d,destination})),setKinds=(kinds:string[])=>setDraft(d=>({...d,kinds})),setEnabled=(enabled:boolean)=>setDraft(d=>({...d,enabled})),setWindow=(windowMinutes:number)=>setDraft(d=>({...d,windowMinutes})),setThreshold=(threshold:number)=>setDraft(d=>({...d,threshold}));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const selected=destinations.find(d=>d.id===destination);
 const needsTest=(d:any)=>d?.test?.state!=='passing'||!d.test.reviewed_at;
 function edit(rule:any){setEditing(rule);setName(rule.name);setDestination(rule.destination);setKinds(JSON.parse(rule.kinds));setEnabled(!!rule.enabled);setWindow(rule.window_ms/60000);setThreshold(rule.threshold);setError('')}
 function clear(){setEditing(null);setName('');setDestination('');setKinds([]);setEnabled(true);setWindow(5);setThreshold(10)}
 async function save(){setBusy(true);setError('');try{await alertApi(`/api/projects/${project}/alerting/rules${editing?'/'+editing.id:''}`,editing?'PUT':'POST',{name,enabled,channel:selected?.channel??editing?.channel,destination,kinds,windowMs:windowMinutes*60000,threshold,...(editing?{revision:editing.revision}:{})});clear();refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="evidence"><h2>Per-project rules</h2><p>New issues and later-release regressions route when captured. Volume spikes count accepted occurrences in complete fixed windows. Suppressed issues do not produce spikes.</p>
 {!destinations.length&&<p className="callout">Add an email destination above before creating a rule.</p>}
 <ul className="alert-records">{rules.map(rule=><li key={rule.id}><div><strong>{rule.name}</strong><p>{destinations.find(d=>d.id===rule.destination)?.kind==='slack'?'Slack':rule.channel==='mail'?'Email':'Webhook'} · {rule.enabled?'Enabled':'Disabled'}</p>{!rule.enabled&&needsTest(destinations.find(d=>d.id===rule.destination))&&<p className="callout">This destination needs a passing test and your review before this rule can be enabled.</p>}<p>{JSON.parse(rule.kinds).map(status).join(', ')}{JSON.parse(rule.kinds).includes('spike')?` · ${rule.threshold} occurrences / ${rule.window_ms/60000} minutes`:''}</p><Details title={`Rule ${rule.name}`}><pre>{JSON.stringify(rule,null,2)}</pre></Details></div><button className="text-button" onClick={()=>edit(rule)}>Edit {rule.name}</button></li>)}</ul>
 <h3>{editing?'Edit rule':'Create rule'}</h3><form className="form-grid" onSubmit={e=>{e.preventDefault();void save()}}>
 <Field label="Rule name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/>
 <label className="form-field">Destination<select required value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Choose destination</option>{editing&&!selected&&destination&&<option value={destination}>Previously selected destination · unavailable</option>}{destinations.map(d=><option key={d.id} value={d.id}>{d.label} · {d.kind==='slack'?'Slack':d.channel==='mail'?'Email':'Webhook'}{d.configured?'':' · blocked'}</option>)}</select></label>
 <fieldset><legend>Alert events</legend>{[['new_issue','New issue'],['regression','Later-release regression'],['spike','Volume spike']].map(([kind,label])=><label className="alert-check" key={kind}><input type="checkbox" checked={kinds.includes(kind)} onChange={e=>setKinds(e.target.checked?[...kinds,kind]:kinds.filter(k=>k!==kind))}/>{label}</label>)}</fieldset>
 {kinds.includes('spike')&&<><label className="form-field">Complete window (minutes)<input type="number" required min={1} max={1440} value={windowMinutes} onChange={e=>setWindow(Number(e.target.value))}/></label><label className="form-field">Accepted occurrence threshold<input type="number" required min={2} max={10000} value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/></label></>}
 <label className="alert-check"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enabled</label>
 {selected&&needsTest(selected)&&<p className="callout">Test this destination and review its passing result before enabling.</p>}
 <p className="muted">Saving creates a new revision and stops queued work from the old revision. An already executing request cannot be retracted. Enabling starts future complete windows; history is never replayed.</p>
 <div><button className="primary-button" disabled={busy||!kinds.length||!destination}>{busy?'Saving…':editing?'Save rule':'Create rule'}</button>{editing&&<button type="button" className="text-button" disabled={busy} onClick={()=>{if(window.confirm('Discard the unsaved rule changes?'))clear()}}>Discard edit</button>}</div></form>{error&&<p role="alert" className="callout">{error}</p>}</section>;
}
