import {useEffect,useState} from 'react';
import {SaveState} from './SaveState';
import {SectionHead} from './SectionHead';
import {useSaveState} from './useAutoPreview';
import type {Request,Run} from './shared';
import type {RecurrencePolicy as Policy} from '../../domain/recurrence/model';

/** Saves as it changes: the preview the server requires runs first, then the policy applies to future intake. */
export function RecurrencePolicy({project,request,busy}:{project:string;request:Request;run:Run;busy:boolean}){
 const [current,setCurrent]=useState<Policy|null>(null),[draft,setDraft]=useState(false),[affected,setAffected]=useState<number|null>(null),[error,setError]=useState('');
 const {state,save}=useSaveState();
 const root=`/api/projects/${encodeURIComponent(project)}/recurrence-policy`;
 const install=(row:Policy)=>{setCurrent(row);setDraft(row.reopenSameRelease)};
 const load=()=>request(root).then(row=>{install(row);setError('')},e=>setError(e.message));
 useEffect(()=>{let alive=true;setCurrent(null);setAffected(null);setError('');request(root).then(row=>{if(alive)install(row)}).catch(e=>{if(alive)setError(e.message)});return()=>{alive=false}},[root,request]);
 const commit=(value:boolean)=>save(async()=>{
  const result=await request(root,'POST',{reopenSameRelease:value,revision:current!.revision,preview:true});
  install(await request(root,'POST',{reopenSameRelease:value,revision:current!.revision,apply:true,preview:result.preview}));setAffected(result.preview.affectedResolvedCount);
 });
 return <section className="evidence" aria-labelledby="recurrence-policy-title"><SectionHead id="recurrence-policy-title" title="Release recurrence" about={<><p>After resolving in the current release or an already observed named release, another event in that release increases the count and appears in the issue history. By default the issue stays resolved. A later release reopens it under the project release ordering rule.</p><p>Applies to future accepted events. Older releases and events without a release keep their existing behavior. Plain Resolve still reopens on the next event. Next-release resolution waits above its boundary; a future named release reopens on its first event, and a later release still reopens it. Capture suppression still prevents reopening.</p></>}/>
  {error&&<p role="alert">{error}</p>}
  {!current?<><p role="status">Loading recurrence policy…</p>{error&&<button className="text-button" onClick={()=>void load()}>Retry recurrence policy</button>}</>:<>
   <label className="checkbox"><input type="checkbox" checked={draft} disabled={busy||state.phase==='saving'} onChange={event=>{setDraft(event.target.checked);void commit(event.target.checked)}}/> Reopen resolutions on another event in the same release</label>
   <SaveState state={state}/>
   {affected!==null&&state.phase==='saved'&&<p className="meta">{affected} currently resolved issue{affected===1?'':'s'} follow this for future same-release events. No issue was reopened.</p>}
  </>}
 </section>;
}
