import { useEffect, useRef, useState } from 'react';
import { Fold } from './Fold';
import { date, type Request } from './shared';
import type { ActivityRow, DiscussionData } from '../../domain/discussion/model';

type Data=DiscussionData&{recurrence:{sameRelease:number;olderRelease:number};activity:ActivityRow[];next:string|null};
/** One read of an issue's discussion, shared by its long-tail section and the Subscribe action under More. */
export function useDiscussion(project:string,issue:string|undefined,refresh:unknown,request:Request,onChanged?:()=>void){
 const base=issue?`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue)}`:'';
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const loadedIssue=useRef('');
 useEffect(()=>{
  if(!base)return;
  let alive=true;setError('');if(loadedIssue.current!==base){loadedIssue.current=base;setData(null)}
  request(base+'/discussion').then(value=>{if(alive)setData(value)}).catch(failure=>{if(alive)setError(failure.message)});
  return ()=>{alive=false};
 },[base,refresh,request]);
 async function mutate(path:string,method:string,input:Record<string,unknown>) {
  if(!data)return false;
  setBusy(true);setError('');
  try {
   await request(base+path,method,input);
   setData(await request(base+'/discussion'));onChanged?.();return true;
  }catch(failure){setError((failure as Error).message);try{setData(await request(base+'/discussion'))}catch{setData(null)}return false}
  finally{setBusy(false)}
 }
 async function older() {
  if(!data?.next)return;setBusy(true);setError('');
  try{const next:Data=await request(base+'/discussion?cursor='+encodeURIComponent(data.next));setData({...next,activity:[...data.activity,...next.activity]})}
  catch(failure){setError((failure as Error).message)}finally{setBusy(false)}
 }
 const subscribed=!!data?.subscription.subscribed;
 const subscription=!data?'':data.subscription.explicit==='unsubscribed'?'You unsubscribed.':subscribed?'Subscribed because '+data.subscription.reasons.map(reason=>reason==='comment'?'you commented':reason==='mention'?'you were mentioned':'you subscribed').join(' and ')+'.':'You are not subscribed.';
 const toggle=()=>data&&mutate('/subscription','PUT',{subscribed:!subscribed,version:data.subscription.version});
 return {issue,data,error,busy,mutate,older,subscribed,subscription,toggle};
}

export function Discussion({discussion}:{discussion:ReturnType<typeof useDiscussion>}) {
 const {issue,data,error,busy,mutate,older}=discussion;
 const [body,setBody]=useState(''),[editing,setEditing]=useState<{id:string;version:number}|null>(null),[editBody,setEditBody]=useState('');
 useEffect(()=>{setEditing(null);setBody('')},[issue]);
 const write=async(path:string,method:string,input:Record<string,unknown>)=>{if(await mutate(path,method,input)){setBody('');setEditing(null)}};
 const comments=data?.comments.length??0;
 return <Fold title="Discussion" meta={!data?error?'Discussion unavailable':'Loading discussion…':`${comments?`${comments} ${comments===1?'comment':'comments'}`:'No comments yet'} · ${discussion.subscribed?'Subscribed':'Not subscribed'}`}>
  <div aria-busy={busy}>
  {error&&<p role="alert">{error}</p>}
  {!data?!error&&<p role="status">Loading discussion…</p>:<>
   {data.canWrite&&<form onSubmit={event=>{event.preventDefault();void write('/comments','POST',{body})}}>
    <label className="form-field">Comment<textarea aria-label="Comment" required value={body} maxLength={4000} rows={4} placeholder="Mention a project member with @name" disabled={busy||data.comments.length>=data.limit} onChange={event=>setBody(event.target.value)}/></label>
    <button className="primary-button" disabled={busy||!body.trim()||data.comments.length>=data.limit}>Post comment</button>
   </form>}
   <p className="meta">{data.recurrence.sameRelease} recurred in resolved release · {data.recurrence.olderRelease} older-release repeats</p>
   <h3>Activity</h3>
   {data.activity.length?<ol className="timeline">{data.activity.map(row=>{
    const comment=row.kind==='comment_added'?data.comments.find(comment=>comment.id===row.detail.comment):null;
    const release=row.detail.release??row.detail.resolvedRelease??row.detail.resolution_release;
    const label:Record<string,string>={resolved_release_recurrence:'Recurred in resolved release',older_release_recurrence:'Repeated in older release',suppression_started:'Archived',suppression_expired:'Archive condition met',priority:'Priority changed',resolution:'Resolved',comment_added:'Comment',comment_edited:'Comment edited',comment_deleted:'Comment deleted'};
    const recurrence=row.detail.recurrenceCount??row.detail.recurrence_count??row.detail.count;
    return <li key={row.id} style={{overflowWrap:'anywhere'}}>
     <p><strong>{label[row.kind]??row.kind.replaceAll('_',' ')}</strong> · {date(row.created)} · {comment?comment.author:row.actor_name??<>{row.actor_kind} <code style={{overflowWrap:'anywhere',wordBreak:'break-word'}}>{row.actor_label}</code></>}</p>
     {row.kind==='comment_added'&&(comment?<>
      {comment.updated!==comment.created&&<p className="muted">Edited {date(comment.updated)}</p>}
      {editing?.id===comment.id?<form onSubmit={event=>{event.preventDefault();void write('/comments/'+encodeURIComponent(comment.id),'PATCH',{body:editBody,version:editing!.version})}}>
       <label className="form-field">Edit comment<textarea aria-label="Edit comment" value={editBody} maxLength={4000} required rows={4} disabled={busy} onChange={event=>setEditBody(event.target.value)}/></label>
       <button className="primary-button" disabled={busy||!editBody.trim()}>Save comment</button> <button type="button" className="text-button" disabled={busy} onClick={()=>setEditing(null)}>Cancel edit</button>
      </form>:<p className="commit-message" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{comment.body}</p>}
      {comment.canEdit&&editing?.id!==comment.id&&<><button className="text-button" disabled={busy} onClick={()=>{setEditing({id:comment.id,version:comment.version});setEditBody(comment.body)}}>Edit comment</button> <button className="text-button" disabled={busy} onClick={()=>void write('/comments/'+encodeURIComponent(comment.id),'DELETE',{version:comment.version})}>Delete comment</button></>}
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
  </div>
 </Fold>;
}
