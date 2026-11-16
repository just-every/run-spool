import { plural } from './readable';
import { useId, useRef, useState } from 'react';
import type { Request, Run } from './shared';

type Selection = {field:string;value:string;action:string};
type Preview = {
 planHash:string;hold:string|null;
 events: {status:string;count:number|null;retained:number;withoutRetainedIdentity:number;explanation:string};
 sessions: {status:string;count:number|null;explanation:string};
 search: {status:string;count:number|null;explanation:string};
 capturedText: {count:number|null;issueTitles:number;ambiguousEvents:number;groupingHeld:number;explanation:string};
 feedback: {status:string;count:number|null};
 unavailable: {store:string;reason:string}[];
};
type Receipt = {id:string;phase:string;deleted:Record<string,number>;requestedAt:string;completedAt:string;seconds:number;retained:{table:string;reason:string}[]};
export function EndUserErasurePreview({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}) {
 const id = useId(), revision = useRef(0), selected=useRef<Selection|null>(null);
 const [field,setField]=useState('email'),[action,setAction]=useState('remove_identity');
 const [value,setValue] = useState(''), [preview,setPreview] = useState<Preview|null>(null), [error,setError] = useState('');
 const [confirm,setConfirm]=useState(''),[receipt,setReceipt]=useState<Receipt|null>(null);
 const reset=()=>{revision.current++;selected.current=null;setPreview(null);setReceipt(null);setConfirm('');setError('')};
 return <section className="evidence" aria-label="End-user erasure preview">
  <h2>End-user erasure</h2>
  <p>Preview exact retained matches for one user. The installation owner can confirm removal. Other aliases and records without this identity cannot be attributed.</p>
  <form onSubmit={event=>{event.preventDefault();const attempt=revision.current,selection={field,value,action};setPreview(null);setReceipt(null);setConfirm('');setError('');void run(async()=>{
   try {const result=await request(`/api/projects/${encodeURIComponent(project)}/end-user-erasure/preview`,'POST',selection);
    if(attempt===revision.current){setPreview(result);selected.current=selection;setValue('');}}
   catch(failure){if(attempt===revision.current)setError((failure as Error).message)}
  })}}>
   <label className="form-field" htmlFor={id+'-field'}>Identity field<select id={id+'-field'} value={field} disabled={busy} onChange={event=>{reset();setField(event.target.value);setValue('')}}>
    <option value="email">Email</option><option value="id">User ID</option><option value="username">Username</option><option value="ip_address">IP address</option>
   </select></label>
   <label className="form-field" htmlFor={id}>{field==='email'?'Email to match':'Identity to match'}<input id={id} type={field==='email'?'email':'text'} required maxLength={field==='email'?320:field==='ip_address'?80:256} autoComplete="off" spellCheck={false} value={value} disabled={busy}
    onChange={event=>{reset();setValue(event.target.value)}} /></label>
   <label className="form-field" htmlFor={id+'-action'}>Erasure action<select id={id+'-action'} value={action} disabled={busy} onChange={event=>{reset();setAction(event.target.value)}}>
    <option value="remove_identity">Remove identity; keep events</option><option value="delete_events">Delete matching events</option>
   </select></label>
   <div className="button-row"><button className="text-button" type="submit" disabled={busy||!value}>Preview matching records</button></div>
  </form>
  {error&&<p role="alert">{error}</p>}
  {preview&&<>
   <div className="callout" role="status">
    <h3>Matching retained records</h3>
    <p>{preview.events.status==='available'?`${preview.events.count} matching ${plural(preview.events.count!, 'event')}`:'Event matching unavailable'} · {preview.events.retained} retained {plural(preview.events.retained, 'event')} · {preview.events.withoutRetainedIdentity} without this retained identity.</p>
    <p>{preview.events.explanation}</p>
    <p>{preview.sessions.count===null?'Session matching unavailable':`${preview.sessions.count} matching ${plural(preview.sessions.count,'session')}`}. {preview.sessions.explanation}</p>
    <p>{preview.search.count===null?'Search tag matching unavailable':`${preview.search.count} matching search tag entries`}. {preview.search.explanation}</p>
    <p>{preview.capturedText.count===null?'Captured text matching unavailable':`${preview.capturedText.count} events with removable captured text · ${preview.capturedText.issueTitles} issue titles`}. {preview.capturedText.explanation}</p>
    {(preview.capturedText.ambiguousEvents>0||preview.capturedText.groupingHeld>0)&&<p>{preview.capturedText.ambiguousEvents} events with ambiguous partial copies · {preview.capturedText.groupingHeld} events with copies that affect grouping. These copies will remain.</p>}
    {action==='delete_events'&&<p>{preview.feedback.count} attached feedback records will also be deleted.</p>}
    <ul>{preview.unavailable.map(row=><li key={row.store}>{row.store}: unavailable. {row.reason}</li>)}</ul>
    {preview.hold&&<p>{preview.hold} Nothing will be erased.</p>}
   </div>
   {preview.events.status==='available'&&!preview.hold&&<form onSubmit={event=>{event.preventDefault();const attempt=revision.current,selection=selected.current;if(!selection)return;setError('');void run(async()=>{
    try{const result=await request(`/api/projects/${encodeURIComponent(project)}/end-user-erasure/confirm`,'POST',{...selection,confirm,planHash:preview.planHash});
     if(attempt===revision.current){selected.current=null;setPreview(null);setConfirm('');setReceipt(result)}}
    catch(failure){if(attempt===revision.current){setError((failure as Error).message);setConfirm('');setPreview(null);selected.current=null}}
   })}}>
    <p>{action==='delete_events'?'Matching events and their attached feedback will be permanently deleted.':'All retained user identity fields on matching events and exact matching session DIDs will be removed. Events stay.'} Downloaded archives and future captures are outside this action.</p>
    <label className="form-field" htmlFor={id+'-confirm'}>Type ERASE USER DATA<input id={id+'-confirm'} autoComplete="off" value={confirm} disabled={busy} onChange={event=>setConfirm(event.target.value)} /></label>
    <div className="button-row"><button className="text-button danger" type="submit" disabled={busy||confirm!=='ERASE USER DATA'}>Confirm user erasure</button></div>
   </form>}
  </>}
  {receipt&&<div className="callout" role="status">
   <h3>Erasure complete</h3>
   <p>{receipt.deleted.event_identities} event identities removed · {receipt.deleted.health_sessions} session identities removed · {receipt.deleted.search_tags} search tag entries removed{receipt.deleted.events!==undefined?` · ${receipt.deleted.events} events deleted`:''}.</p>
   <p>{receipt.deleted.captured_text_events} events with captured text removed · {receipt.deleted.issue_titles} issue titles cleared of matching text.</p>
   <p>Started {receipt.requestedAt} · completed {receipt.completedAt} · {receipt.seconds} seconds.</p>
   <p>Receipt {receipt.id}. Older archives are refused when this installation or a trusted later journal knows the erasure.</p>
   <ul>{receipt.retained.map(row=><li key={row.table}>{row.table}: {row.reason}</li>)}</ul>
  </div>}
 </section>;
}
