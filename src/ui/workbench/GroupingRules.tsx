import {useEffect,useState} from 'react';
import type {Request,Run} from './shared';
import { GroupingRulePreview } from './GroupingRulePreview';
import {useSettingDoc} from './useSettingDoc';
import {SaveAnnouncer,SaveFailure,SavedMark} from './SaveMarks';
// Grouping rules regroup later events, so an edit is held until its one-step confirm under the fields:
// preview it against retained events, then apply it.
export function GroupingRules({project,request,run,busy,approvedPreview,onSaved}:{project:string;request:Request;run:Run;busy:boolean;approvedPreview?:any;onSaved?:()=>void}){
 const [preview,setPreview]=useState<any>(null),[status,setStatus]=useState(''),[error,setError]=useState('');
 const root=`/api/projects/${encodeURIComponent(project)}/grouping-rules`;
 const doc=useSettingDoc<any,any>({
  key:`grouping:${project}`,
  read:async()=>{const [row,history]=await Promise.all([request(root),request(root+'/versions')]);return {row,versions:history.versions}},
  draftOf:data=>data.row.policy,
  write:async(data,policy,keepalive)=>{const row=await request(root,'PUT',{revision:data.row.revision,policy},{keepalive});return {row,versions:(await request(root+'/versions')).versions}},
  onSaved:()=>onSaved?.(),
 });
 const draft=doc.draft,current=doc.data?.row,versions:any[]=doc.data?.versions??[];
 const hold=(policy:any)=>{setPreview(null);setStatus('');doc.edit(policy,{hold:true,field:'rules'})};
 useEffect(()=>{if(!approvedPreview)return;let alive=true;setPreview(null);
  request(root).then(row=>{if(!alive)return;if(row.revision!==approvedPreview.revision)throw new Error('Grouping rule revision conflict. Reopen the approved proposal.');doc.edit(approvedPreview.policy,{hold:true,field:'rules'});setPreview({...approvedPreview,policy:JSON.stringify(approvedPreview.policy)});setError('');setStatus('Approved agent rule proposal opened for review. Apply grouping rules explicitly to change later intake.');document.getElementById('grouping-rules-heading')?.scrollIntoView({block:'start'});}).catch(error=>{if(alive)setError(error.message)});return()=>{alive=false};
 },[approvedPreview,root,request]);
 const action=(fn:()=>Promise<void>)=>void run(async()=>{try{setError('');await fn()}catch(e){setError((e as Error).message)}});
 return <section className="evidence" aria-labelledby="grouping-rules-heading"><h2 id="grouping-rules-heading">Project grouping rules</h2>
 <p>Preview JavaScript, Python, Go and Sentry stack and fingerprint rules against retained events, then apply them to later intake. Recorded grouping and prior corrections stay inspectable. Native events keep their default grouping unless a project rule changes it.</p>
 {(error||doc.loadError)&&<p role="alert">{error||doc.loadError}</p>}
 {!draft||!current?<><p role="status">{doc.loadError?'Rules unavailable.':'Loading grouping rules…'}</p>{doc.loadError&&<button className="text-button" onClick={doc.reload}>Retry grouping rules</button>}</>:<>
 <p>Active revision {current.revision}. Ordered stack rules use path, module, package, function or family with +app, -app, +group and -group. The first matching fingerprint rule wins; project fingerprints take precedence over SDK fingerprints. Native stacks use the first contributing frame; Sentry stacks use contributing in-app frames. Only * is a wildcard.</p>
 <label className="form-field">Stack trace rules<textarea aria-label="Stack trace rules" rows={4} value={draft.stack} disabled={busy} placeholder="stack.module:vendor.* -app" onChange={e=>hold({...draft,stack:e.target.value})}/></label>
 <label className="form-field">Fingerprint rules<textarea aria-label="Fingerprint rules" rows={4} value={draft.fingerprint} disabled={busy} placeholder="error.type:KeyError -> checkout-account" onChange={e=>hold({...draft,fingerprint:e.target.value})}/></label>
 <p className="muted">Fingerprint matchers: error.type and error.value (any cause), message, level, logger, sdk.name, family and tags.KEY. Combine matchers with spaces; quote values containing spaces. Use comma-separated fingerprint values, including {'{{ default }}'} to retain default grouping. Native events expose type, message, family, frame path and function; module, package, tags and SDK metadata require Sentry evidence. Unknown syntax is refused.</p>
 <label className="form-field">Previous grouping policy<select aria-label="Previous grouping policy" disabled={busy} value="" onChange={e=>{const policy=e.target.value==='0'?{version:1,stack:'',fingerprint:''}:versions.find(row=>String(row.revision)===e.target.value)?.policy;if(policy){hold(policy);setStatus('Previous policy loaded as a draft. Preview and apply it as a new revision to roll back.')}}}><option value="">Choose a previous revision to restore…</option>{current.revision>0&&<option value="0">Revision 0 · default grouping</option>}{versions.filter(row=>row.revision<current.revision&&row.policy).map(row=><option key={row.revision} value={row.revision}>Revision {row.revision}</option>)}</select></label>
 <div className="button-row"><button className="text-button" disabled={busy} onClick={()=>action(async()=>{let after='';const rows:any[]=[];let revision:number|undefined;do{const page=await request(root+'/preview','POST',{policy:draft,after});if(revision!==undefined&&revision!==page.revision)throw new Error('Grouping rules changed during preview. Refresh and preview the current revision.');revision=page.revision;rows.push(...page.rows);after=page.next??''}while(after);setPreview({rows,revision,policy:JSON.stringify(draft)});setStatus('Grouping preview complete. No occurrences moved.');})}>Preview grouping rules</button><SavedMark doc={doc} field="rules"/>
 </div>
 {(doc.held||preview)&&<div className="save-confirm"><p>Applying these rules changes how later events are grouped.</p><div className="button-row"><button className="primary-button" disabled={busy||!preview||preview.policy!==JSON.stringify(draft)} onClick={()=>action(async()=>{await doc.commit('rules');setPreview(null);setStatus('')})}>Apply grouping rules</button>{doc.held&&<button className="text-button" onClick={()=>{doc.discard();setPreview(null);setStatus('')}}>Discard changes</button>}</div></div>}
 <SaveFailure doc={doc} field="rules"/><SaveAnnouncer doc={doc}/>
 {preview&&<GroupingRulePreview preview={preview}/>}
 {status&&<p role="status">{status}</p>}
 </>}
 </section>;
}
