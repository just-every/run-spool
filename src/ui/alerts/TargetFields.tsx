import { useEffect,useState } from 'react';
import { alertApi } from './client';
export type NotifyDraft={type:'email'|'team'|'member'|'issue_owners';id:string;fallthrough:'active_members'|'no_one'};
export const initialTarget:NotifyDraft={type:'email',id:'',fallthrough:'no_one'};
export function TargetFields({project,value,onChange,editing}:{project:string;value:NotifyDraft;onChange:(v:NotifyDraft)=>void;editing:boolean}){
 const [choices,setChoices]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;alertApi(`/api/projects/${project}/alerting/recipients`).then(v=>live&&setChoices(v)).catch(e=>live&&setError(e.message));return()=>{live=false}},[project]);
 const rows=value.type==='member'?(choices?.members??[]).map((m:any)=>({id:m.member,label:m.name||m.email})):(choices?.teams??[]).map((t:any)=>({id:t.team,label:t.team}));
 return <>
 <label className="form-field">Notify<select aria-label="Notify" disabled={editing} value={value.type} onChange={e=>onChange({...value,type:e.target.value as NotifyDraft['type'],id:''})}><option value="email">Email address</option><option value="team">Project team</option><option value="member">Project member</option><option value="issue_owners">Issue owners</option></select></label>
 {['team','member'].includes(value.type)&&<label className="form-field">{value.type==='team'?'Team':'Member'}<select aria-label={value.type==='team'?'Team':'Member'} required value={value.id} onChange={e=>onChange({...value,id:e.target.value})}><option value="">Choose {value.type}</option>{value.id&&!rows.some((r:any)=>r.id===value.id)&&<option value={value.id}>Unavailable target</option>}{rows.map((r:any)=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>}
 {value.type!=='email'&&<label className="form-field">When no authorized recipient<select aria-label="When no authorized recipient" value={value.fallthrough} onChange={e=>onChange({...value,fallthrough:e.target.value as NotifyDraft['fallthrough']})}><option value="no_one">Notify no one</option><option value="active_members">Active project members</option></select></label>}
 {value.type==='issue_owners'&&<p>Issue ownership is unavailable. The selected fallthrough determines the recipients.</p>}
 {error&&<p role="alert">{error}</p>}
 </>;
}
