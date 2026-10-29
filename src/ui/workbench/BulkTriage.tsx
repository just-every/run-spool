import {ResolutionPicker} from './ResolutionPicker';
import { useState } from 'react';
import { api } from './client';
import { stateLabel } from './shared';
import {initialSuppression,SuppressionFields,SuppressionDetails} from './Suppression';
import type {SuppressionInput} from '../../domain/suppression/model';

type Selection = {id:string;revision:number;title?:string};
export function useBulkSelection() {
 const [selected,setSelected] = useState<Selection[]>([]);
 return {selected,clear:()=>setSelected([]),toggle:(row:Selection)=>setSelected(previous=>previous.some(item=>item.id===row.id)?previous.filter(item=>item.id!==row.id):[...previous,{id:row.id,revision:row.revision,title:row.title}]),select:(rows:Selection[])=>setSelected(rows.map(({id,revision,title})=>({id,revision,title})))};
}
export function BulkTriage({project,selected,refreshing,clear,onApplied}:{project:string;selected:Selection[];refreshing:boolean;clear:()=>void;onApplied:()=>void}) {
 const [member,setMember]=useState(''),[target,setTarget]=useState('');
 const [resolution,setResolution]=useState('plain'),[resolutionRelease,setResolutionRelease]=useState('');
 const [suppression,setSuppression]=useState<SuppressionInput>(initialSuppression);
 const [state,setState] = useState('acknowledged'),[preview,setPreview] = useState<any>(null),[busy,setBusy] = useState(false),[error,setError] = useState(''),[notice,setNotice] = useState('');
 const selection = JSON.stringify(selected), current = preview?.selection===selection && preview?.state===state && preview?.resolutionMode===resolution && preview?.resolutionRelease===resolutionRelease && preview?.suppressionInput===JSON.stringify(suppression) && preview?.member===member && preview?.target===target ? preview : null;
 const act = async(apply:boolean) => {
  setBusy(true);setError('');setNotice('');
  try {
   const result = await api(`/api/projects/${encodeURIComponent(project)}/bulk-triage`,'POST',{issues:selected.map(({id,revision})=>({id,revision})),...state==='reviewed'?{action:'reviewed'}:state==='assigned'?{action:'assign',member:member.trim()||null}:state==='merged'?{action:'merge',target}:{state},apply,...state==='resolved'?{resolution,...resolution==='named'?{release:resolutionRelease}:{}}:{},...state==='suppressed'?{suppression}:{},...apply?{preview:current?.preview}:{}});
   if(apply){setPreview(null);clear();setNotice(`${result.changed} ${result.changed===1?'issue':'issues'} ${stateLabel(result.state).toLowerCase()}.`);onApplied()}
   else setPreview({...result,selection,resolutionMode:resolution,resolutionRelease,suppressionInput:JSON.stringify(suppression),member,target});
  }catch(failure){setError((failure as Error & {status?:number}).status===409?(failure as Error).message:(apply?'Triage response was not confirmed. Refresh and review the current states. ':'Preview unavailable. Try Preview triage again. ')+(failure as Error).message);setPreview(null);if(apply||(failure as Error & {status?:number}).status===409){clear();onApplied()}}finally{setBusy(false)}
 };
 return <section className="bulk-triage" aria-label="Bulk triage" aria-busy={busy}>
  <p>{selected.length} selected · Selection is limited to the displayed page.</p>
  <div className="issue-search-actions"><label className="form-field">Bulk action<select aria-label="Bulk action" value={state} disabled={busy} onChange={event=>{setState(event.target.value);setPreview(null)}}><option value="reviewed">Mark reviewed</option><option value="assigned">Assign member</option><option value="merged">Merge</option><option value="acknowledged">Acknowledge</option><option value="resolved">Resolve</option><option value="open">Reopen</option><option value="suppressed">Archive</option></select></label>{state==='resolved'&&<ResolutionPicker project={project} value={resolution} release={resolutionRelease} disabled={busy} label="Bulk resolution" onChange={(mode,release)=>{setResolution(mode);setResolutionRelease(release);setPreview(null)}}/>}{state==='assigned'&&<label className="form-field">Member handle<input aria-label="Member handle" value={member} maxLength={80} disabled={busy} placeholder="@name; blank clears assignment" onChange={event=>{setMember(event.target.value);setPreview(null)}}/></label>}{state==='merged'&&<label className="form-field">Merge into<select aria-label="Merge into" value={target} disabled={busy} onChange={event=>{setTarget(event.target.value);setPreview(null)}}><option value="">Choose selected issue</option>{selected.map(row=><option key={row.id} value={row.id}>{row.title??row.id}</option>)}</select></label>}<button className="text-button" disabled={busy||refreshing||!selected.length||(state==='merged'&&(selected.length<2||!selected.some(row=>row.id===target)))||(state==='resolved'&&resolution==='named'&&!resolutionRelease)||(state==='suppressed'&&!suppression.reason.trim())} onClick={()=>void act(false)}>Preview triage</button><button className="text-button" disabled={busy||refreshing||!selected.length} onClick={()=>{clear();setPreview(null)}}>Clear selection</button></div>
  {state==='suppressed'&&<SuppressionFields value={suppression} onChange={value=>{setSuppression(value);setPreview(null)}} disabled={busy}/>}
  {current&&<div className="callout"><h3>Review {current.issues.length} {current.issues.length===1?'issue':'issues'}</h3><ul>{current.issues.map((row:any)=><li key={row.id}>{row.title} · {state==='reviewed'?'Mark reviewed; triage unchanged':state==='assigned'?(member.trim()?'Assign to '+member.trim():'Clear assignment'):state==='merged'?(row.id===target?'Keep this issue; absorb selected events':'Move retained events into the selected target'):`${stateLabel(row.state)} → ${state==='suppressed'?'Archived':stateLabel(state)}`}{state==='resolved'?` · ${row.resolvedRelease}`:''}{row.suppression&&<SuppressionDetails plan={row.suppression}/>}</li>)}</ul>{state==='resolved'&&<p>{current.resolution}</p>}{state==='merged'&&<details><summary>Review {current.plan.moves.length} exact event moves</summary><ul>{current.plan.issues.map((row:any)=><li key={row.id}>{selected.find(item=>item.id===row.id)?.title??row.id}: {row.count} → {row.after} events</li>)}</ul><ol>{current.plan.moves.map((move:any)=><li key={move.occurrence} style={{overflowWrap:'anywhere'}}>{move.event}: {move.from} → {move.to}</li>)}</ol></details>}<button className="highlight-button" disabled={busy} onClick={()=>void act(true)}>Apply to {current.issues.length} {current.issues.length===1?'issue':'issues'}</button> <button className="text-button" disabled={busy} onClick={()=>setPreview(null)}>Cancel preview</button></div>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
