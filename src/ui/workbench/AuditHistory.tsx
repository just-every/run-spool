import { auditAction, auditOutcome, auditSource, auditSubject } from './auditLabels';
import { personLabel } from './readable';
import { useRef, useState } from 'react';
import { useLiveRead } from './useLiveRead';
import { date, download, type Request, type Run } from './shared';
import type { AuditRow } from '../../domain/audit/types';

type Page={rows:AuditRow[];next:string|null;highWater:number;coverage:string};
export function AuditHistory({request,run,busy}:{request:Request;run:Run;busy:boolean}) {
 const [page,setPage]=useState<Page|null>(null),[rows,setRows]=useState<AuditRow[]>([]),[failure,setFailure]=useState(''),[status,setStatus]=useState('');
 // Read quietly while the tab is visible. The newest page replaces the head of the list in place; earlier entries already loaded stay.
 const generation=useRef(0),paged=useRef(false),loaded=useRef(false);
 useLiveRead(async (signal,background)=>{
  const started=generation.current;
  try{
   const value:Page=await request('/api/audit','GET',undefined,{background});
   if(signal.aborted||started!==generation.current)return;
   loaded.current=true;
   setPage(current=>current&&paged.current?{...value,next:current.next}:value);
   setRows(current=>{const ids=new Set(value.rows.map(row=>row.id)),next=paged.current?[...value.rows,...current.filter(row=>!ids.has(row.id))]:value.rows;return next.length===current.length&&next.every((row,index)=>row.id===current[index].id)?current:next});
   setFailure('');
  }catch(error){if(!signal.aborted)setFailure((error as Error).message)}
 },[request]);
 const perform=(work:()=>Promise<void>)=>void run(async()=>{setFailure('');generation.current++;try{await work();}catch(error){setFailure((error as Error).message);}finally{generation.current++}});
 return <section className="evidence" aria-labelledby="audit-history-heading">
  <h2 id="audit-history-heading">Organization audit</h2>
  <p>Review who acted, what they did and the result. Private identifiers remain available in the audit exports. Restored history follows this installation’s own history.</p>
  {page&&<p className="muted">{page.coverage}</p>}
  <div className="button-row">
   {page&&<><button className="text-button" disabled={busy} onClick={()=>perform(async()=>{const value=await request(`/api/audit/export?format=json&highWater=${page.highWater}`);download(value,'spool-audit.json');setStatus('JSON audit export prepared.');})}>Export JSON</button>
    <a className="text-button" href={`/api/audit/export?format=csv&highWater=${page.highWater}`}>Export CSV</a></>}
  </div>
  {failure&&<p role="alert">Audit could not be loaded: {failure}</p>}
  {!page&&!failure&&<p role="status">Loading organization history…</p>}
  {page&&rows.length===0&&<p>No audit entries have been recorded.</p>}
  {rows.length>0&&<ol aria-label="Audit entries" style={{listStyle:'none',padding:0}}>{rows.map(row=><li key={row.id} className="callout" style={{marginBottom:'1rem',overflowWrap:'anywhere'}}>
   <p><strong>{auditAction(row.action)}</strong> · {auditOutcome(row.outcome)}</p>
   <p><time dateTime={new Date(row.created).toISOString()}>{date(row.created)}</time> · {auditSource(row.source)}</p>
   <dl><dt>Actor</dt><dd style={{marginInlineStart:0}}>{personLabel(row.actor_kind)}</dd>
    <dt>Subject</dt><dd style={{marginInlineStart:0}}>{auditSubject(row.subject_kind)}</dd>
   </dl>
  </li>)}</ol>}
  {page?.next&&<button className="text-button" disabled={busy} onClick={()=>perform(async()=>{const value=await request('/api/audit?cursor='+encodeURIComponent(page.next!));paged.current=true;setPage(value);setRows(current=>[...current,...value.rows]);setStatus('Earlier entries loaded.');})}>Load earlier entries</button>}
  {status&&<p role="status">{status}</p>}
 </section>;
}
