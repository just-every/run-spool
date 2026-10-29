import {ResolutionPicker} from './ResolutionPicker';
import { useState } from 'react';
import { api } from './client';
import { stateLabel } from './shared';
import {initialSuppression,SuppressionFields,SuppressionDetails} from './Suppression';
import type {SuppressionInput} from '../../domain/suppression/model';

type Selection = {id:string;revision:number};
export function useBulkSelection() {
 const [selected,setSelected] = useState<Selection[]>([]);
 return {selected,clear:()=>setSelected([]),toggle:(row:Selection)=>setSelected(previous=>previous.some(item=>item.id===row.id)?previous.filter(item=>item.id!==row.id):[...previous,{id:row.id,revision:row.revision}]),select:(rows:Selection[])=>setSelected(rows.map(({id,revision})=>({id,revision})))};
}
export function BulkTriage({project,selected,refreshing,clear,onApplied}:{project:string;selected:Selection[];refreshing:boolean;clear:()=>void;onApplied:()=>void}) {
 const [resolution,setResolution]=useState('plain'),[resolutionRelease,setResolutionRelease]=useState('');
 const [suppression,setSuppression]=useState<SuppressionInput>(initialSuppression);
 const [state,setState] = useState('acknowledged'),[preview,setPreview] = useState<any>(null),[busy,setBusy] = useState(false),[error,setError] = useState(''),[notice,setNotice] = useState('');
 const selection = JSON.stringify(selected), current = preview?.selection===selection && preview?.state===state && preview?.resolutionMode===resolution && preview?.resolutionRelease===resolutionRelease && preview?.suppressionInput===JSON.stringify(suppression) ? preview : null;
 const act = async(apply:boolean) => {
  setBusy(true);setError('');setNotice('');
  try {
   const result = await api(`/api/projects/${encodeURIComponent(project)}/bulk-triage`,'POST',{issues:selected,...state==='reviewed'?{action:'reviewed'}:{state},apply,...state==='resolved'?{resolution,...resolution==='named'?{release:resolutionRelease}:{}}:{},...state==='suppressed'?{suppression}:{},...apply?{preview:current?.preview}:{}});
   if(apply){setPreview(null);clear();setNotice(`${result.changed} ${result.changed===1?'issue':'issues'} ${stateLabel(result.state).toLowerCase()}.`);onApplied()}
   else setPreview({...result,selection,resolutionMode:resolution,resolutionRelease,suppressionInput:JSON.stringify(suppression)});
  }catch(failure){setError((failure as Error & {status?:number}).status===409?(failure as Error).message:(apply?'Triage response was not confirmed. Refresh and review the current states. ':'Preview unavailable. Try Preview triage again. ')+(failure as Error).message);setPreview(null);if(apply||(failure as Error & {status?:number}).status===409){clear();onApplied()}}finally{setBusy(false)}
 };
 // Bulk actions appear once a row is selected; after an apply only its outcome line stays.
 if(!selected.length&&!current)return notice||error?<p role={error?'alert':'status'} className="bulk-outcome">{error||notice}</p>:null;
 return <section className="bulk-triage" aria-label="Bulk triage" aria-busy={busy}>
  <p className="bulk-count"><strong>{selected.length} selected</strong> <span className="meta">· Selection is limited to the displayed page.</span></p>
  <div className="issue-search-actions"><label className="form-field">Bulk action<select aria-label="Bulk action" value={state} disabled={busy} onChange={event=>{setState(event.target.value);setPreview(null)}}><option value="reviewed">Mark reviewed</option><option value="acknowledged">Acknowledge</option><option value="resolved">Resolve</option><option value="open">Reopen</option><option value="suppressed">Archive</option></select></label>{state==='resolved'&&<ResolutionPicker project={project} value={resolution} release={resolutionRelease} disabled={busy} label="Bulk resolution" onChange={(mode,release)=>{setResolution(mode);setResolutionRelease(release);setPreview(null)}}/>}<button className="text-button" disabled={busy||refreshing||!selected.length||(state==='resolved'&&resolution==='named'&&!resolutionRelease)||(state==='suppressed'&&!suppression.reason.trim())} onClick={()=>void act(false)}>Preview triage</button><button className="text-button" disabled={busy||refreshing||!selected.length} onClick={()=>{clear();setPreview(null)}}>Clear selection</button></div>
  {state==='suppressed'&&<SuppressionFields value={suppression} onChange={value=>{setSuppression(value);setPreview(null)}} disabled={busy}/>}
  {current&&<div className="callout"><h3>Review {current.issues.length} {current.issues.length===1?'issue':'issues'}</h3><ul>{current.issues.map((row:any)=><li key={row.id}>{row.title} · {state==='reviewed'?'Mark reviewed; triage unchanged':`${stateLabel(row.state)} → ${state==='suppressed'?'Archived':stateLabel(state)}`}{state==='resolved'?` · ${row.resolvedRelease}`:''}{row.suppression&&<SuppressionDetails plan={row.suppression}/>}</li>)}</ul>{state==='resolved'&&<p>{current.resolution}</p>}<button className="primary-button" disabled={busy} onClick={()=>void act(true)}>Apply to {current.issues.length} {current.issues.length===1?'issue':'issues'}</button> <button className="text-button" disabled={busy} onClick={()=>setPreview(null)}>Cancel preview</button></div>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>;
}
