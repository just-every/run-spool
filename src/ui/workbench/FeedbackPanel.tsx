import {useCallback, useEffect, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useLiveRead} from './useLiveRead';
import {Details} from './Details';
import {date, type Request, type Run} from './shared';
import {hrefFor} from './location';
import './feedback.css';

type Feedback = {id:string; message:string; received:number; eventId:string|null; issueId:string|null; association:string; hasPrivate?:boolean};
type FeedbackPage = {items:Feedback[]; next?:string|null; total:number; bounds:{retained:number;perMinute:number;messageCharacters:number}};

export function FeedbackPanel({project, issue, request, run, busy}: {
 project:string; issue?:string; request:Request; run:Run; busy:boolean;
}) {
 const [page,setPage]=useState<FeedbackPage|null>(null),[failure,setFailure]=useState(''),[notice,setNotice]=useState('');
 const [confirm,setConfirm]=useState<string|null>(null),[loading,setLoading]=useState(false);
 const root=`/api/projects/${encodeURIComponent(project)}/feedback`;
 const query=issue?`?issue=${encodeURIComponent(issue)}`:'';
 const load=useCallback(async(after?:string)=>{
  setLoading(true);
  try {
   const result:FeedbackPage=await request(root+query+(after?`${query?'&':'?'}cursor=${encodeURIComponent(after)}`:''));
   setPage(current=>after&&current?{...result,items:[...current.items,...result.items]}:result);
   setFailure('');
  } catch(error) {setFailure((error as Error).message)}
  finally {setLoading(false)}
 },[root,query,request]);
 useEffect(()=>{setPage(null);setFailure('');setNotice('');setConfirm(null)},[root,query]);
 useLiveRead(async(signal,background)=>{
  if(!background)setLoading(true);
  try {
   let result:FeedbackPage=await request(root+query);
   while(result.next&&result.items.length<(page?.items.length??0)) {
    const more:FeedbackPage=await request(root+query+`${query?'&':'?'}cursor=${encodeURIComponent(result.next)}`);
    result={...more,items:[...result.items,...more.items]};
   }
   if(!signal.aborted){setPage(result);setFailure('')}
  }catch(error){if(!signal.aborted)setFailure((error as Error).message)}
  finally{if(!signal.aborted)setLoading(false)}
 },[root,query,request],{live:!!issue});
 const withdraw=(id:string)=>void run(async()=>{
  try {
   await request(`${root}/${encodeURIComponent(id)}`,'DELETE');
   setPage(current=>current?{...current,items:current.items.filter(item=>item.id!==id),total:Math.max(0,current.total-1)}:null);
   setConfirm(null);setNotice('Feedback withdrawn. Its description, contact, screenshot and replies are removed from this installation and future exports.');
   await load();
  } catch(error) {setFailure((error as Error).message)}
 });
 return <section className="evidence feedback-panel" aria-label={issue?'Issue feedback':'Project feedback inbox'}>
  <div className="feedback-heading"><h2>{issue?'User feedback':'Feedback inbox'}</h2>{!issue&&<button className="text-button" disabled={busy||loading} onClick={()=>void load()}>Refresh feedback</button>}</div>
  {issue?<Details title="User feedback"><p>Reports linked to events in this issue. Consented contact, screenshots and replies are available only in the private feedback inbox.</p></Details>:<p>Reports received for this project, including reports sent without an event. Review consented details and reply privately to the reporter.</p>}
  {!issue&&<p className="muted">Private details require explicit consent from the reporter. Email is sent only when you choose Send reply. Replies stay out of the issue and agent evidence.</p>}
  {!issue&&page&&<p className="muted">Current limits: {page.bounds.messageCharacters.toLocaleString()} characters per report, {page.bounds.perMinute} reports per minute and {page.bounds.retained.toLocaleString()} retained reports per project. Larger or excess submissions are refused with a reason.</p>}
  {failure&&<div role="alert"><p>Feedback could not be loaded: {failure}</p><button className="text-button" disabled={loading} onClick={()=>void load()}>Retry feedback</button></div>}
  {failure&&page&&<p className="muted">Showing the last successful refresh. New reports may be unavailable.</p>}
  {!page&&loading&&<p role="status">Loading feedback…</p>}
  {page&&!page.items.length&&<p>{failure?'No feedback was present at the last successful refresh.':`No feedback ${issue?'is linked to this issue yet.':'has arrived for this project yet.'}`}</p>}
  {page&&page.items.length>0&&<p className="metadata">Showing {page.items.length} of {page.total} reports</p>}
  <ul className="feedback-list">{page?.items.map(item=><li key={item.id}>
   <p className="feedback-message">{item.message}</p>
   <p className="metadata">Received {date(item.received)}</p>
   <p className="metadata">{item.issueId?<>{!issue&&<><Link to={hrefFor(project,'issues',item.issueId) as any}>Open related issue</Link> · </>}Linked event <code>{item.eventId}</code></>:item.eventId?<>Referenced event unavailable · <code>{item.eventId}</code></>:'Standalone report · no event reference'}</p>
   {!issue&&item.hasPrivate&&<FeedbackReview key={item.id} root={`${root}/${encodeURIComponent(item.id)}`} {...{request,run,busy}}/>}
   {confirm===item.id?<div className="feedback-confirm"><p>Withdraw this report? Downloaded archives and copies outside this installation remain outside this action.</p><div className="button-row"><button className="danger-button" disabled={busy} onClick={()=>withdraw(item.id)}>Confirm withdrawal</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(null)}>Keep feedback</button></div></div>:<button className="text-button" disabled={busy} onClick={()=>setConfirm(item.id)}>Withdraw feedback</button>}
  </li>)}</ul>
  {page?.next&&<button className="text-button" disabled={busy||loading} onClick={()=>void load(page.next!)}>Load more feedback</button>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}

type PrivateReview = {consent:true;contact:string|null;screenshot:boolean;review:string;replies:{id:string;message:string;state:string;code:string;created:number}[]};
function FeedbackReview({root,request,run,busy}:{root:string;request:Request;run:Run;busy:boolean}){
 const [open,setOpen]=useState(false),[detail,setDetail]=useState<{private:PrivateReview|null;mail:{enabled:boolean;code:string}}|null>(null);
 const [failure,setFailure]=useState(''),[message,setMessage]=useState(''),[screenshot,setScreenshot]=useState(false),[imageFailed,setImageFailed]=useState(false);
 const [requestId,setRequestId]=useState(()=>crypto.randomUUID());
 const load=async()=>{try{setDetail(await request(root+'/private'));setFailure('')}catch(error){setFailure((error as Error).message)}};
 const send=()=>void run(async()=>{
  try{await request(root+'/replies','POST',{id:requestId,message,consent:true});setMessage('');setRequestId(crypto.randomUUID());await load()}
  catch(error){setFailure((error as Error).message)}
 });
 return <div className="feedback-review">
  <button className="text-button" aria-expanded={open} disabled={busy} onClick={()=>{setOpen(!open);if(!open)void load()}}>{open?'Close private review':'Review report privately'}</button>
  {open&&<div className="feedback-private">
   {failure&&<p role="alert">Private review could not be completed: {failure}</p>}
   {!detail&&!failure&&<p role="status">Loading private details…</p>}
   {detail?.private&&<>
    <p>Reporter consent recorded · {detail.private.review==='reviewed'?'Reviewed':'Awaiting review'}</p>
    <p className="feedback-contact">{detail.private.contact?<>Private contact: <span>{detail.private.contact}</span></>:'No contact shared. Email replies are unavailable.'}</p>
    {detail.private.screenshot&&<>
     <button className="text-button" aria-expanded={screenshot} onClick={()=>{setScreenshot(!screenshot);setImageFailed(false)}}>{screenshot?'Hide screenshot':'Review screenshot'}</button>
     {screenshot&&<>{imageFailed?<p role="alert">Screenshot unavailable. Refresh private review before trying again.</p>:<img className="feedback-screenshot" src={root+'/screenshot'} alt="Screenshot shared by the reporter with consent" onError={()=>setImageFailed(true)}/>}<p className="muted">Image metadata is stripped. Visible pixels can still contain personal information.</p></>}
    </>}
    {detail.private.review!=='reviewed'&&<button className="text-button" disabled={busy} onClick={()=>void run(async()=>{try{await request(root+'/review','POST',{reviewed:true});await load()}catch(error){setFailure((error as Error).message)}})}>Mark report reviewed</button>}
    <div className="feedback-replies" aria-label="Private replies">
     {detail.private.replies.map(reply=><div className="feedback-reply" key={reply.id}><p>{reply.message}</p><p className="metadata">{date(reply.created)} · {reply.state==='sent'?'Sent · accepted by email provider; mailbox delivery unconfirmed':reply.state==='never_sent'?'Never sent':reply.state==='failed'?'Failed · delivery not confirmed':'Queued · awaiting provider result'}</p></div>)}
    </div>
    {!detail.mail.enabled&&<p role="status">{detail.mail.code==='mail_off'?'Email is off for this installation. Replies will not be sent.':detail.mail.code==='mail_suppressed'?'This local installation suppresses email. Replies will not be sent.':'Email is not configured for this installation. Replies will not be sent.'}</p>}
    {detail.private.contact&&<form onSubmit={event=>{event.preventDefault();send()}}>
     <label>Reply to reporter<textarea value={message} onChange={event=>{setMessage(event.target.value);setRequestId(crypto.randomUUID())}} maxLength={2000} rows={3} disabled={busy||!detail.mail.enabled}/></label>
     <p className="muted">Send this message to the private contact above. A sent state means the email provider accepted it.</p>
     <button className="primary-button" type="submit" disabled={busy||!detail.mail.enabled||!message.trim()||detail.private.replies.length>=20}>Send reply</button>
    </form>}
   </>}
  </div>}
 </div>;
}
