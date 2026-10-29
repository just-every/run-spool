import {useCallback, useEffect, useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useLiveRead} from './useLiveRead';
import {Fold} from './Fold';
import {SectionHead} from './SectionHead';
import {date, type Request, type Run} from './shared';
import {hrefFor} from './location';
import './feedback.css';

type Feedback = {id:string; message:string; received:number; eventId:string|null; issueId:string|null; association:string};
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
   setConfirm(null);setNotice('Feedback withdrawn. Its description is removed from this installation and future exports.');
   await load();
  } catch(error) {setFailure((error as Error).message)}
 });
 const body=<>
  {issue?<p className="meta">Reports linked to events in this issue. Contact details and attachments are excluded.</p>:null}
  {failure&&<div role="alert"><p>Feedback could not be loaded: {failure}</p><button className="text-button" disabled={loading} onClick={()=>void load()}>Retry feedback</button></div>}
  {failure&&page&&<p className="muted">Showing the last successful refresh. New reports may be unavailable.</p>}
  {!page&&loading&&<p role="status">Loading feedback…</p>}
  {page&&!page.items.length&&<p>{failure?'No feedback was present at the last successful refresh.':`No feedback ${issue?'is linked to this issue yet.':'has arrived for this project yet.'}`}</p>}
  {page&&page.items.length>0&&<p className="metadata">Showing {page.items.length} of {page.total} reports</p>}
  <ul className="feedback-list">{page?.items.map(item=><li key={item.id}>
   <p className="feedback-message">{item.message}</p>
   <p className="metadata">Received {date(item.received)}</p>
   <p className="metadata">{item.issueId?<>{!issue&&<><Link to={hrefFor(project,'issues',item.issueId) as any}>Open related issue</Link> · </>}Linked event <code>{item.eventId}</code></>:item.eventId?<>Referenced event unavailable · <code>{item.eventId}</code></>:'Standalone report · no event reference'}</p>
   {confirm===item.id?<div className="feedback-confirm"><p>Withdraw this report? Downloaded archives and copies outside this installation remain outside this action.</p><div className="button-row"><button className="danger-button" disabled={busy} onClick={()=>withdraw(item.id)}>Confirm withdrawal</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(null)}>Keep feedback</button></div></div>:<button className="text-button" disabled={busy} onClick={()=>setConfirm(item.id)}>Withdraw feedback</button>}
  </li>)}</ul>
  {page?.next&&<button className="text-button" disabled={busy||loading} onClick={()=>void load(page.next!)}>Load more feedback</button>}
  {notice&&<p role="status">{notice}</p>}
 </>;
 if(issue)return <Fold title="User feedback" label="Issue feedback" className="feedback-panel" meta={failure&&!page?'Feedback unavailable':!page?'Loading feedback…':page.total?`${page.total} ${page.total===1?'report':'reports'}`:'No feedback linked yet'}>{body}</Fold>;
 return <section className="evidence feedback-panel" aria-label="Project feedback inbox">
  <SectionHead title="Feedback inbox" about={<><p>All text reports received for this project, including reports sent without an event. Contact details and attachments are not retained.</p><p>Use your application’s consent form before sending feedback through Sentry’s captureFeedback or feedback widget. Spool currently receives text only; replies and screenshot review are unavailable.</p>{page&&<p>Current limits: {page.bounds.messageCharacters.toLocaleString()} characters per report, {page.bounds.perMinute} reports per minute and {page.bounds.retained.toLocaleString()} retained reports per project. Larger or excess submissions are refused with a reason.</p>}</>}><button className="text-button" disabled={busy||loading} onClick={()=>void load()}>Refresh feedback</button></SectionHead>
  {body}
 </section>;
}
