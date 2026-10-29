import {SessionRates} from './SessionRates';
import { useEffect, useState } from 'react';
import { Fold } from './Fold';
import { date, type Request, type Run } from './shared';
/** One read of an issue's suspect changes, shared by its long-tail section and the Suspect change property. */
export function useSuspects(project:string,issue:string|undefined,request:Request,enabled:boolean){
 const [view,setView]=useState<any>(null),[failure,setFailure]=useState('');
 const root=issue?`/api/projects/${encodeURIComponent(project)}/suspects/issues/${encodeURIComponent(issue)}`:'';
 const load=async()=>{const value=await request(root);setView(value);return value};
 useEffect(()=>{if(!root||!enabled)return;let alive=true;setView(null);setFailure('');request(root).then(value=>{if(alive)setView(value)}).catch(error=>{if(alive)setFailure(error.message)});return()=>{alive=false}},[root,request,enabled]);
 return {root,view,failure,setFailure,load};
}
export function SuspectChanges({suspects,request,run,busy}:{suspects:ReturnType<typeof useSuspects>;request:Request;run:Run;busy:boolean}) {
 const {root,view,failure,setFailure,load}=suspects;
 const [notes,setNotes]=useState<Record<string,string>>({}),[notice,setNotice]=useState('');
 const judge=(candidate:any,judgment:string)=>void run(async()=>{try{await request(root,'PUT',{release:candidate.release,sha:candidate.sha,judgment,note:notes[JSON.stringify([candidate.release,candidate.sha])]??'',revision:candidate.decision?.revision??0});await load();setNotice('Engineer judgment recorded. Occurrences and issue state are unchanged.');setFailure('')}catch(error){setFailure((error as Error).message)}});
 const count=view?.candidates.length??0;
 return <Fold title="Suspect changes" meta={failure?'Suspect changes unavailable':!view?'Loading suspect changes…':count?`${count} ${count===1?'candidate':'candidates'} · ${view.candidates.map((candidate:any)=>candidate.release).join(', ')}`:'No candidate release'}>
  <p className="meta">Correlation, not a demonstrated cause. A judgment records your evidence; it never changes occurrences, grouping, counts or issue state.</p>
  {failure&&<p role="alert">Suspect changes unavailable: {failure}</p>}{!view&&!failure&&<p role="status">Loading suspect changes…</p>}
  {view&&!view.candidates.length&&<p>No retained release or reactivation establishes a candidate.</p>}
  {view?.candidates.map((candidate:any)=>{const key=JSON.stringify([candidate.release,candidate.sha]);return <article key={key} className="suspect-candidate"><h3>{candidate.release}{candidate.sha&&<> · <code>{candidate.sha.slice(0,12)}</code></>}</h3><p>{candidate.correlation}</p><ul>{candidate.reason.map((reason:any,index:number)=><li key={index}>{reason.kind==='reactivation'?'Reactivation':'First retained occurrence'} · {date(reason.record.received)} · record <code>{reason.record.alertId??reason.record.id}</code></li>)}</ul><p>Commit inclusion: {candidate.inclusion.source} · {date(candidate.inclusion.created)}</p>{candidate.deployments.length?<ul>{candidate.deployments.map((deployment:any)=><li key={deployment.id}>Recorded deployment <code>{deployment.id}</code> · {deployment.environment} · {date(deployment.started)} to {date(deployment.deadline)} (owner deadline)</li>)}</ul>:<p>No deployment window recorded for this release.</p>}<p>{candidate.changedSource.reason}</p>
   {candidate.decision&&<p><strong>Engineer judgment: {candidate.decision.judgment}</strong> · {candidate.decision.note}</p>}
   <label className="form-field">Evidence note for {candidate.sha?candidate.sha.slice(0,12):candidate.release}<textarea maxLength={600} value={notes[key]??''} onChange={event=>setNotes(current=>({...current,[key]:event.target.value}))}/></label><div className="button-row"><button className="text-button" disabled={busy||!notes[key]?.trim()} onClick={()=>judge(candidate,'confirmed')}>Confirm suspect</button><button className="text-button" disabled={busy||!notes[key]?.trim()} onClick={()=>judge(candidate,'rejected')}>Reject suspect</button></div></article>})}
  {view&&<><p className="muted">Showing {view.candidates.length} of {view.bounds.available} candidates from the first retained occurrence and latest {view.bounds.reactivationsIncluded} reactivations.</p><h3>Release comparison</h3><p>{date(view.comparison.from)} to {date(view.comparison.to)} · receipt window</p><p>{view.comparison.coverage}</p><div className="table-region"><table className="data-table"><thead><tr><th scope="col">Release</th><th scope="col">Occurrences</th><th scope="col">Distinct issues</th></tr></thead><tbody>{view.comparison.rows.map((row:any)=><tr className="data-row" key={row.release}><th scope="row" style={{overflowWrap:'anywhere'}}>{row.release}</th><td data-label="Occurrences">{row.occurrences}</td><td data-label="Distinct issues">{row.issues}</td></tr>)}</tbody></table></div><h4>Observed session comparison</h4>{view.comparison.health.rows.length?<SessionRates rows={view.comparison.health.rows}/>:<p>No observed sessions in this window; rates are unavailable.</p>}<details><summary>Session comparison method</summary><p>{view.comparison.health.method}</p></details><p>{view.comparison.releaseLess} release-less occurrences excluded from this comparison.</p></>}{notice&&<p role="status">{notice}</p>}
 </Fold>;
}
