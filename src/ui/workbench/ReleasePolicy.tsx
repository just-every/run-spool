import {useState} from 'react';
import type {Request,Run} from './shared';
import {useSettingDoc} from './useSettingDoc';
import {SaveAnnouncer,SaveFailure,SavedMark} from './SaveMarks';
// The ordering rule moves regression boundaries, so changing it asks once under its field (preview, then apply).
// The name pattern only shapes later intake and saves as you type.
export function ReleasePolicy({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}){
 const [preview,setPreview]=useState<any>(null),[status,setStatus]=useState(''),[error,setError]=useState('');
 const root=`/api/projects/${encodeURIComponent(project)}/release-policy`;
 const doc=useSettingDoc<any,any>({key:`release-policy:${project}`,read:()=>request(root),draftOf:row=>row.policy,write:(row,policy,keepalive)=>request(root,'PUT',{revision:row.revision,policy},{keepalive})});
 const draft=doc.draft,current=doc.data;
 const previewButton=<button className="text-button" disabled={busy} onClick={()=>action(async()=>{let after='';const rows:any[]=[];do{const p=await request(root+'/preview','POST',{policy:draft,after});rows.push(...p.rows);after=p.next??''}while(after);setPreview({rows,policy:JSON.stringify(draft)});setStatus('Release policy preview complete. Stored events are unchanged.')})}>Preview release policy</button>;
 const previewCallout=preview&&<div className="callout"><h3>Resolution boundary preview</h3><p>{preview.rows.length} resolved issues checked · {preview.rows.filter((r:any)=>r.changedReleaseComparisons.length).length} have changed release comparisons.</p><details><summary>Issue boundaries</summary><pre>{JSON.stringify(preview.rows,null,2)}</pre></details></div>;
 const action=(fn:()=>Promise<void>)=>void run(async()=>{try{setError('');await fn()}catch(e){setError((e as Error).message)}});
 const order=(value:string)=>{const next={...draft,order:value};setPreview(null);if(value===current.policy.order&&doc.held){doc.discard();doc.edit(next,{field:'pattern'});return}doc.edit(next,{hold:value!==current.policy.order,field:'order'})};
 return <section className="evidence" aria-labelledby="release-policy-title"><h2 id="release-policy-title">Sentry release identity</h2><p>Sentry events can arrive without a release or automatically create one. Native events still require a registered release and build. An omitted dist has a separate no-dist identity; an explicit dist is kept distinct.</p>{(error||doc.loadError)&&<p role="alert">{error||doc.loadError}</p>}
 {!draft||!current?<><p role="status">{doc.loadError?'Release policy unavailable.':'Loading release policy…'}</p>{doc.loadError&&<button className="text-button" onClick={doc.reload}>Retry release policy</button>}</>:<>
 <label className="form-field"><span>Release ordering rule<SavedMark doc={doc} field="order"/></span><select aria-label="Release ordering rule" value={draft.order} onChange={e=>order(e.target.value)}><option value="sentry">First seen (default)</option><option value="first_seen">First seen</option><option value="semver">Semantic versions, then other names</option><option value="registered">Registered sequence only</option></select></label>
 {doc.held&&<div className="save-confirm"><p>Changing the ordering rule can move regression boundaries for resolved issues. Preview the change, then apply it.</p><div className="button-row">{previewButton}<button className="primary-button" disabled={busy||!preview||preview.policy!==JSON.stringify(draft)} onClick={()=>action(async()=>{await doc.commit('order');setPreview(null);setStatus('')})}>Apply release policy</button><button className="text-button" onClick={()=>{doc.discard();setPreview(null);setStatus('')}}>Keep current rule</button></div>{previewCallout}</div>}
 <SaveFailure doc={doc} field="order"/>
 <p>First seen orders every release by its original first-seen time, then UTF-8 release name. Semantic order ranks all semantic versions first by precedence (build metadata is ignored), then non-semantic names by first seen. Ties use first seen and UTF-8 release name. Lists, latest and regression share this order. Registered sequence only refuses missing or unregistered releases and builds with a counted reason. Plain Resolve reopens on the next accepted event under either rule. Next-release resolution waits for a release later than the latest at resolution time; named-release resolution waits for the chosen release or a later one. Older and release-less events do not reopen either.</p>
 <label className="form-field"><span>Automatic release name pattern<SavedMark doc={doc} field="pattern"/></span><input aria-label="Automatic release name pattern" value={draft.pattern} onChange={e=>{setPreview(null);doc.edit({...draft,pattern:e.target.value},{field:'pattern'})}} onBlur={doc.flush}/></label><SaveFailure doc={doc} field="pattern"/><p className="muted">Only * is a wildcard. Unseen names outside the pattern are accepted as release none, with a processing note. Invalid names also become none. Existing releases stay available.</p>
 {!doc.held&&<div className="button-row">{previewButton}</div>}{!doc.held&&previewCallout}
 {status&&<p role="status">{status}</p>}<SaveAnnouncer doc={doc}/>
 </>}
 </section>;
}
