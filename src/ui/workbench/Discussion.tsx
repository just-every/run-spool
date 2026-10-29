import { useEffect, useRef, useState } from 'react';
import { date, type Request } from './shared';
import type { ActivityRow, DiscussionData } from '../../domain/discussion/model';

type Data=DiscussionData&{recurrence:{sameRelease:number;olderRelease:number};activity:ActivityRow[];next:string|null};
export function Discussion({project,issue,refresh,request,onChanged}:{project:string;issue:string;refresh:unknown;request:Request;onChanged?:()=>void}) {
 const base=`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}`;
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[body,setBody]=useState(''),[editing,setEditing]=useState<{id:string;version:number}|null>(null),[editBody,setEditBody]=useState(''),[busy,setBusy]=useState(false);
 const loadedIssue=useRef('');
 useEffect(()=>{
  let alive=true;setError('');if(loadedIssue.current!==base){loadedIssue.current=base;setData(null);setEditing(null);setBody('')}
  request(base+'/discussion').then(value=>{if(alive)setData(value)}).catch(failure=>{if(alive)setError(failure.message)});
  return ()=>{alive=false};
 },[base,refresh,request]);
 async function mutate(path:string,method:string,input:Record<string,unknown>) {
  if(!data)return;
  setBusy(true);setError('');
  try {
   await request(base+path,method,input);
   setData(await request(base+'/discussion'));setBody('');setEditing(null);onChanged?.();
  }catch(failure){setError((failure as Error).message);try{setData(await request(base+'/discussion'))}catch{setData(null)}}
  finally{setBusy(false)}
 }
 async function older() {
  if(!data?.next)return;setBusy(true);setError('');
  try{const next:Data=await request(base+'/discussion?cursor='+encodeURIComponent(data.next));setData({...next,activity:[...data.activity,...next.activity]})}
  catch(failure){setError((failure as Error).message)}finally{setBusy(false)}
 }
 return <section className="evidence" aria-label="Discussion" aria-busy={busy}>
  <h2>Discussion</h2>
  {error&&<p role="alert">{error}</p>}
  {!data?!error&&<p role="status">Loading discussion…</p>:<>
   <p>{data.subscription.explicit==='unsubscribed'?'You unsubscribed.':data.subscription.subscribed?'Subscribed because '+data.subscription.reasons.map(reason=>reason==='comment'?'you commented':reason==='mention'?'you were mentioned':'you subscribed').join(' and ')+'.':'You are not subscribed.'}</p>
   {data.canWrite&&<button className="text-button" disabled={busy} onClick={()=>void mutate('/subscription','PUT',{subscribed:!data.subscription.subscribed,version:data.subscription.version})}>{data.subscription.subscribed?'Unsubscribe':'Subscribe'}</button>}
   <p className="muted">Notifications are not sent yet.</p>
   {data.canWrite&&<form onSubmit={event=>{event.preventDefault();void mutate('/comments','POST',{body})}}>
    <label className="form-field">Comment<textarea aria-label="Comment" required value={body} maxLength={4000} rows={4} style={{width:'100%',boxSizing:'border-box'}} disabled={busy||data.comments.length>=data.limit} onChange={event=>setBody(event.target.value)}/></label>
    <p className="muted">Mention a project member with @name or the part of their email before @. Up to 4,000 characters per comment.</p>
    <button className="highlight-button" disabled={busy||!body.trim()||data.comments.length>=data.limit}>Post comment</button>
   </form>}
   <p>{data.recurrence.sameRelease} recurred in resolved release · {data.recurrence.olderRelease} older-release repeats</p>
   <h3>Activity</h3>
   {data.activity.length?<ol className="timeline">{data.activity.map(row=>{
    const comment=row.kind==='comment_added'?data.comments.find(comment=>comment.id===row.detail.comment):null;
    const release=row.detail.release??row.detail.resolvedRelease??row.detail.resolution_release;
    const label:Record<string,string>={resolved_release_recurrence:'Recurred in resolved release',older_release_recurrence:'Repeated in older release',suppression_started:'Archived',suppression_expired:'Archive condition met',priority:'Priority changed',assignment:'Assignment changed',resolution:'Resolved',comment_added:'Comment',comment_edited:'Comment edited',comment_deleted:'Comment deleted'};
    const recurrence=row.detail.recurrenceCount??row.detail.recurrence_count??row.detail.count;
    return <li key={row.id} style={{overflowWrap:'anywhere'}}>
     <p><strong>{label[row.kind]??row.kind.replaceAll('_',' ')}</strong> · {date(row.created)} · {comment?comment.author:row.actor_name??<>{row.actor_kind} <code style={{overflowWrap:'anywhere',wordBreak:'break-word'}}>{row.actor_label}</code></>}</p>
     {row.kind==='assignment'&&<p>{row.detail.assignee?'Assigned to '+(row.assignee_name??'former member'):'Unassigned'}</p>}
     {row.kind==='comment_added'&&(comment?<>
      {comment.updated!==comment.created&&<p className="muted">Edited {date(comment.updated)}</p>}
      {editing?.id===comment.id?<form onSubmit={event=>{event.preventDefault();void mutate('/comments/'+encodeURIComponent(comment.id),'PATCH',{body:editBody,version:editing!.version})}}>
       <label className="form-field">Edit comment<textarea aria-label="Edit comment" value={editBody} maxLength={4000} required rows={4} style={{width:'100%',boxSizing:'border-box'}} disabled={busy} onChange={event=>setEditBody(event.target.value)}/></label>
       <button className="highlight-button" disabled={busy||!editBody.trim()}>Save comment</button> <button type="button" className="text-button" disabled={busy} onClick={()=>setEditing(null)}>Cancel edit</button>
      </form>:<p className="commit-message" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comment.body}</p>}
      {comment.canEdit&&editing?.id!==comment.id&&<><button className="text-button" disabled={busy} onClick={()=>{setEditing({id:comment.id,version:comment.version});setEditBody(comment.body)}}>Edit comment</button> <button className="text-button" disabled={busy} onClick={()=>void mutate('/comments/'+encodeURIComponent(comment.id),'DELETE',{version:comment.version})}>Delete comment</button></>}
     </>:<p className="muted">This comment was deleted or its author was erased.</p>)}
     {typeof row.detail.reason==='string'&&<p>{row.detail.reason}</p>}
     {typeof row.detail.forecast==='number'&&<p>Forecast: {row.detail.forecast} occurrences per hour.</p>}
     {typeof row.detail.deadline==='number'&&<p>Follow-up due {date(row.detail.deadline)}.</p>}
     {typeof row.detail.occurrenceTarget==='number'&&<p>Reopen at {row.detail.occurrenceTarget} occurrences.</p>}
     {typeof row.detail.userTarget==='number'&&<p>Reopen at {row.detail.userTarget} affected users.</p>}
     {typeof row.detail.priority==='string'&&<p>Priority: {row.detail.priority}</p>}
     {typeof row.detail.state==='string'&&<p>Status: {row.detail.state}</p>}
     {typeof release==='string'&&<p>Release: {release||'No release'}</p>}
     {typeof row.detail.mode==='string'&&<p>{row.kind.startsWith('suppression_')?'Archive condition':'Resolution'}: {row.detail.mode.replaceAll('_',' ')}</p>}
     {typeof recurrence==='number'&&<p>Occurrences: {recurrence}</p>}
    </li>;
   })}</ol>:<p>No activity recorded yet.</p>}
   {data.next&&<button className="text-button" disabled={busy} onClick={()=>void older()}>Older activity</button>}
  </>}
 </section>;
}
