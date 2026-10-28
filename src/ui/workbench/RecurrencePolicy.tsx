import {useEffect,useState} from 'react';
import type {Request,Run} from './shared';
import type {RecurrencePolicy as Policy,RecurrencePreview} from '../../domain/recurrence/model';

export function RecurrencePolicy({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}){
 const [current,setCurrent]=useState<Policy|null>(null),[draft,setDraft]=useState(false),[preview,setPreview]=useState<RecurrencePreview|null>(null),[status,setStatus]=useState(''),[error,setError]=useState('');
 const root=`/api/projects/${encodeURIComponent(project)}/recurrence-policy`;
 const install=(row:Policy)=>{setCurrent(row);setDraft(row.reopenSameRelease);setPreview(null)};
 const load=async()=>install(await request(root));
 useEffect(()=>{let alive=true;setCurrent(null);setPreview(null);setStatus('');setError('');request(root).then(row=>{if(alive)install(row)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[root,request]);
 const action=(fn:()=>Promise<void>)=>void run(async()=>{try{setError('');setStatus('');await fn()}catch(e){setError((e as Error).message)}});
 return <section className="evidence" aria-labelledby="recurrence-policy-title"><h2 id="recurrence-policy-title">Release recurrence</h2>
  <p>After resolving in the current release, another event in that release increases the count and appears in the issue history. By default the issue stays resolved. A later release reopens it under the project release ordering rule.</p>
  {error&&<p role="alert">{error}</p>}
  {!current?<><p role="status">Loading recurrence policy…</p>{error&&<button onClick={()=>action(load)}>Retry recurrence policy</button>}</>:<>
   <label className="check"><input type="checkbox" checked={draft} disabled={busy} onChange={event=>{setDraft(event.target.checked);setPreview(null);setStatus('')}}/> Reopen current-release resolutions on another event in the same release</label>
   <p className="muted">Applies to future accepted events. Older releases and events without a release keep their existing behavior. Plain Resolve still reopens on the next event. Next-release resolution waits above its boundary; named-release resolution reopens at its chosen release or later. Capture suppression still prevents reopening.</p>
   <div className="button-row"><button className="text-button" disabled={busy} onClick={()=>action(async()=>{
    const result=await request(root,'POST',{reopenSameRelease:draft,revision:current.revision,preview:true});setPreview(result.preview);setStatus('Recurrence preview complete. Stored events and issue states are unchanged.');
   })}>Preview recurrence policy</button><button className="primary-button" disabled={busy||!preview||preview.revision!==current.revision||preview.reopenSameRelease!==draft} onClick={()=>action(async()=>{
    install(await request(root,'POST',{reopenSameRelease:draft,revision:current.revision,apply:true,preview}));setStatus('Recurrence policy saved for future intake.');
   })}>Save recurrence policy</button><button className="text-button" disabled={busy} onClick={()=>action(load)}>Refresh recurrence policy</button></div>
   {preview&&<div className="callout"><h3>Resolved issue preview</h3><p>{preview.affectedResolvedCount} currently resolved issue{preview.affectedResolvedCount===1?'':'s'} would change behavior for future same-release events. No issue is reopened by saving this policy.</p></div>}
   {status&&<p role="status">{status}</p>}
  </>}
 </section>;
}
