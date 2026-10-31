import { useEffect, useRef, useState } from 'react';
import { Field, type Request, type Run } from './shared';

type Snapshot = { revision:number; limit:number|null; period:string; used:number; retryAfter:number };
export function KeyRateLimit({project,keyHash,refreshVersion,request,run,busy}:{project:string;keyHash:string;refreshVersion:number;request:Request;run:Run;busy:boolean}) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[enabled,setEnabled]=useState(false),[limit,setLimit]=useState('100'),[period,setPeriod]=useState('minute'),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const dirty=useRef(false);
 const path=`/api/projects/${project}/keys/${keyHash}/rate-limit`;
 useEffect(()=>{
  let active=true;setError('');
  request(path).then(value=>{
   if(!active)return;
   if(dirty.current)setSnapshot(previous=>previous?{...previous,used:value.used,retryAfter:value.retryAfter}:value);
   else{setSnapshot(value);setEnabled(value.limit!==null);setLimit(String(value.limit??100));setPeriod(value.period)}
  }).catch(()=>{if(active)setError('Key rate limit unavailable. Close and reopen Settings to retry.')});
  return()=>{active=false};
 },[path,request,refreshVersion]);
 return <section aria-label="Capture key event rate"><h3>Event rate limit</h3>
  {error&&<p role="alert">{error}</p>}
  {!snapshot&&!error&&<p>Loading key rate limit…</p>}
  {snapshot&&<form onSubmit={event=>{event.preventDefault();void run(async()=>{const next=await request(path,'PUT',{revision:snapshot.revision,limit:enabled?Number(limit):null,period});dirty.current=false;setSnapshot(next);setSaved(true)})}}>
   <label><input type="checkbox" checked={enabled} onChange={event=>{dirty.current=true;setEnabled(event.target.checked);setSaved(false)}}/> Limit this capture key</label>
   <Field label="Accepted events per period" type="number" min="1" step="1" required disabled={!enabled} value={limit} onChange={event=>{dirty.current=true;setLimit(event.target.value);setSaved(false)}}/>
   <label className="form-field"><span>Rate period</span><select value={period} onChange={event=>{dirty.current=true;setPeriod(event.target.value);setSaved(false)}}><option value="minute">Minute</option><option value="hour">Hour</option></select></label>
   <p>{snapshot.limit===null?'No individual key limit.':`${snapshot.used} of ${snapshot.limit} events accepted in the current UTC ${snapshot.period}.`} Project limits also apply.</p>
   <p>Only new accepted errors spend this limit. Filtered events and duplicate retries do not. Changes keep current minute and hour usage. Other keys continue independently.</p>
   <button className="primary-button" disabled={busy}>Save key rate limit</button>{saved&&<p role="status">Key rate limit saved.</p>}
  </form>}
 </section>;
}
