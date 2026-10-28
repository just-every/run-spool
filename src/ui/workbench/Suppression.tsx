import {useEffect,useState} from 'react';
import {date,type Request,type Run} from './shared';
import type {SuppressionInput,SuppressionMode,SuppressionPlan} from '../../domain/suppression/model';

export const initialSuppression:SuppressionInput={mode:'forever',reason:''};
const localTime=(time:number)=>new Date(time-new Date(time).getTimezoneOffset()*60000).toISOString().slice(0,16);
export function SuppressionFields({value,onChange,disabled}:{value:SuppressionInput;onChange:(input:SuppressionInput)=>void;disabled:boolean}){
 const mode=(next:SuppressionMode)=>onChange({mode:next,reason:value.reason,...next==='until'?{until:Date.now()+3600000}:next==='count'?{count:10}:next==='users'?{users:10}:next==='snooze'?{durationMs:3600000}:{}});
 return <>
  <label className="form-field">Archive condition<select aria-label="Archive condition" disabled={disabled} value={value.mode} onChange={event=>mode(event.target.value as SuppressionMode)}>
   <option value="forever">Until manually reopened</option><option value="until">Until a date and time</option><option value="count">Until additional occurrences</option><option value="users">Until an affected user total</option><option value="escalating">Until events exceed this issue’s forecast</option><option value="snooze">Snooze for a duration</option>
  </select></label>
  <label className="form-field">Archive reason<textarea aria-label="Archive reason" maxLength={500} required disabled={disabled} value={value.reason} onChange={event=>onChange({...value,reason:event.target.value})}/></label>
  {value.mode==='until'&&<label className="form-field">Archive until (local time)<input type="datetime-local" aria-label="Archive until" disabled={disabled} value={value.until?localTime(value.until):''} onChange={event=>onChange({...value,until:new Date(event.target.value).getTime()})}/></label>}
  {value.mode==='count'&&<label className="form-field">Additional occurrences<input type="number" aria-label="Additional occurrences" min={1} step={1} disabled={disabled} value={value.count??''} onChange={event=>onChange({...value,count:Number(event.target.value)})}/></label>}
  {value.mode==='users'&&<label className="form-field">Affected users target<input type="number" aria-label="Affected users target" min={1} step={1} disabled={disabled} value={value.users??''} onChange={event=>onChange({...value,users:Number(event.target.value)})}/></label>}
  {value.mode==='snooze'&&<label className="form-field">Snooze minutes<input type="number" aria-label="Snooze minutes" min={1} step={1} disabled={disabled} value={(value.durationMs??0)/60000||''} onChange={event=>onChange({...value,durationMs:Number(event.target.value)*60000})}/></label>}
  <p className="muted">Capture continues while archived. A scheduled check reopens the issue when its condition is met and adds Needs attention. Snooze duration starts when applied. Reasons are scrubbed before saving.</p>
 </>;
}
export function SuppressionDetails({plan}:{plan:SuppressionPlan}){
 return <div>
  <p>Reason: {plan.input.reason}</p>
  {plan.input.mode==='forever'&&<p>Archived until manually reopened.</p>}
  {plan.deadline!==null&&<p>{plan.input.mode==='snooze'?`Snooze for ${plan.input.durationMs!/60000} minutes from apply`:`Reopen at the first scheduled check after ${date(plan.deadline)}` }.</p>}
  {plan.occurrenceTarget!==null&&<p>{plan.input.count} more occurrences · current count {plan.metrics.occurrences} · reopen at {plan.occurrenceTarget}.</p>}
  {plan.userTarget!==null&&<><p>Current affected users: {plan.metrics.users} · reopen at {plan.userTarget} affected users. Unattributed events: {plan.metrics.unattributed}.</p><p className="muted">Affected users are distinct retained Sentry user keys after identity policy, or bounded native client identifiers. Missing and dropped identity does not count as a user. Forwarded addresses do not identify users.</p></>}
  {plan.forecast!==null&&<p>Forecast: {plan.forecast} occurrences per hour, the greater of this issue’s historical hourly maximum ({plan.metrics.historicalHourlyMaximum}) and current rolling-hour count ({plan.metrics.rollingOccurrences}). Reopen only when the rolling-hour count is strictly greater than {plan.forecast}. The forecast is fixed when applied.</p>}
 </div>;
}

export function Suppression({project,issue,request,run,busy,onChange,readOnly=false}:{project:string;issue:{id:string;revision:number;state:string};request:Request;run:Run;busy:boolean;onChange:()=>void;readOnly?:boolean}){
 const [input,setInput]=useState<SuppressionInput>(initialSuppression),[preview,setPreview]=useState<{preview:string;suppression:SuppressionPlan}|null>(null),[history,setHistory]=useState<any[]|null>(null),[version,setVersion]=useState<string|null>(null),[error,setError]=useState(''),[status,setStatus]=useState('');
 const root=`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue.id)}/suppression`;
 useEffect(()=>{let alive=true;setPreview(null);setVersion(null);setError('');request(root).then(row=>{if(alive){setHistory(row.history);setVersion(row.version)}}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[root,issue.state,request]);
 const update=(next:SuppressionInput)=>{setInput(next);setPreview(null);setStatus('')};
 const act=(apply:boolean)=>void run(async()=>{setError('');setStatus('');try{
  const result=await request(root,'POST',{version,suppression:input,apply,...apply?{preview:preview?.preview}:{}});
  if(apply){const next=await request(root);setHistory(next.history);setVersion(next.version);setPreview(null);setStatus('Issue archived. Capture continues.');onChange()}else setPreview(result);
 }catch(failure){setError((failure as Error).message);setPreview(null)}});
 return <section className="evidence" aria-labelledby="suppression-title"><h2 id="suppression-title">Archive issue</h2>
  {!readOnly&&<><SuppressionFields value={input} onChange={update} disabled={busy}/>
  <div className="button-row"><button className="text-button" disabled={busy||!version||!input.reason.trim()} onClick={()=>act(false)}>Preview archive</button><button className="primary-button" disabled={busy||!preview} onClick={()=>act(true)}>Archive issue</button></div>
  </>}
  {history?.some(row=>row.state==='active')&&<div className="callout">{history.filter(row=>row.state==='active').slice(0,1).map(row=><div key={row.id}><p><strong>{row.historical?'Restored archive history':'Archived'}</strong> · {row.mode}</p><p>{row.reason}</p>{row.deadline!==null&&<p>Follow-up due {date(row.deadline)}.</p>}{row.forecast!==null&&<p>Forecast: {row.forecast} occurrences per hour. Reopens above this forecast.</p>}{row.occurrence_target!==null&&<p>Reopens at {row.occurrence_target} occurrences.</p>}{row.user_target!==null&&<p>Reopens at {row.user_target} affected users.</p>}</div>)}</div>}
  {preview&&<div className="callout"><h3>Archive preview</h3><SuppressionDetails plan={preview.suppression}/></div>}
  {error&&<p role="alert">{error}</p>}{status&&<p role="status">{status}</p>}
  {history&&history.length>0&&<details><summary>Archive history ({history.length})</summary><ol>{history.map(row=><li key={row.id}>{date(row.started)} · {row.mode} · {row.state}{row.historical?' · restored history':''}<p>{row.reason}</p>{row.forecast!==null&&<p>Forecast: {row.forecast} occurrences per hour.</p>}</li>)}</ol></details>}
 </section>;
}
