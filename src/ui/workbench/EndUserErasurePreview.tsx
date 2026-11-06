import { useId, useRef, useState } from 'react';
import type { Request, Run } from './shared';

type Preview = {
 events: {status:string;count:number|null;retained:number;withoutRetainedEmail:number;explanation:string};
 unavailable: {store:string;reason:string}[];
};
export function EndUserErasurePreview({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}) {
 const id = useId(), revision = useRef(0);
 const [email,setEmail] = useState(''), [preview,setPreview] = useState<Preview|null>(null), [error,setError] = useState('');
 return <section className="evidence" aria-label="End-user erasure preview">
  <h2>End-user erasure preview</h2>
  <p>Preview retained event counts for one exact email under keep or hash policy. This does not erase data or approve an erasure.</p>
  <form onSubmit={event=>{event.preventDefault();const attempt=revision.current;setPreview(null);setError('');void run(async()=>{
   try {const result=await request(`/api/projects/${encodeURIComponent(project)}/end-user-erasure/preview`,'POST',{email});
    if(attempt===revision.current){setPreview(result);setEmail('');}}
   catch(failure){if(attempt===revision.current)setError((failure as Error).message)}
  })}}>
   <label className="form-field" htmlFor={id}>Email to match<input id={id} type="email" required maxLength={320} autoComplete="off" spellCheck={false} value={email} disabled={busy}
    onChange={event=>{revision.current++;setEmail(event.target.value);setPreview(null);setError('')}} /></label>
   <div className="button-row"><button className="text-button" type="submit" disabled={busy||!email}>Preview matching records</button></div>
  </form>
  {error&&<p role="alert">{error}</p>}
  {preview&&<div className="callout" role="status">
   <h3>Matching retained records</h3>
   <p>{preview.events.status==='available'?`${preview.events.count} matching events`:'Event matching unavailable'} · {preview.events.retained} retained events · {preview.events.withoutRetainedEmail} without a retained email.</p>
   <p>{preview.events.explanation}</p>
   <ul>{preview.unavailable.map(row=><li key={row.store}>{row.store}: unavailable. {row.reason}</li>)}</ul>
   <p>Identity removal, event deletion, completed receipts and restore protection for an individual remain unavailable.</p>
  </div>}
 </section>;
}
