import { useEffect, useState } from 'react';
import { date, download, type Request, type Run } from './shared';
import type { AuditRow } from '../../domain/audit/types';

type Page={rows:AuditRow[];next:string|null;highWater:number;coverage:string};
export function AuditHistory({request,run,busy}:{request:Request;run:Run;busy:boolean}) {
 const [page,setPage]=useState<Page|null>(null),[rows,setRows]=useState<AuditRow[]>([]),[failure,setFailure]=useState(''),[status,setStatus]=useState('');
 useEffect(()=>{
  let alive=true;
  request('/api/audit').then(value=>{if(alive){setPage(value);setRows(value.rows);setFailure('')}}).catch(error=>{if(alive)setFailure(error.message)});
  return()=>{alive=false};
 },[request]);
 const perform=(work:()=>Promise<void>)=>void run(async()=>{setFailure('');try{await work();}catch(error){setFailure((error as Error).message);}});
 const refresh=()=>perform(async()=>{const value=await request('/api/audit');setPage(value);setRows(value.rows);setStatus('Showing the latest organization history.');});
 return <section className="evidence" aria-labelledby="audit-history-heading">
  <h2 id="audit-history-heading">Organization audit</h2>
  <p>Permanent action facts use private actor and subject aliases. Erasure removes their identity links.</p>
  <p className="muted">Request entries describe HTTP responses. Transaction and service entries describe the facts recorded by those writers.</p>
  <div className="button-row">
   <button className="text-button" disabled={busy} onClick={refresh}>Refresh history</button>
   {page&&<><button className="text-button" disabled={busy} onClick={()=>perform(async()=>{const value=await request(`/api/audit/export?format=json&highWater=${page.highWater}`);download(value,'spool-audit.json');setStatus('JSON audit export prepared.');})}>Export JSON</button>
    <a className="text-button" href={`/api/audit/export?format=csv&highWater=${page.highWater}`}>Export CSV</a></>}
  </div>
  {failure&&<p role="alert">Audit could not be loaded: {failure}</p>}
  {!page&&!failure&&<p role="status">Loading organization history…</p>}
  {page&&rows.length===0&&<p>No audit entries have been recorded.</p>}
  {rows.length>0&&<ol aria-label="Audit entries" style={{listStyle:'none',padding:0}}>{rows.map(row=><li key={row.id} className="callout" style={{marginBottom:'1rem',overflowWrap:'anywhere'}}>
   <p><strong>{row.action.replaceAll('.',' · ')}</strong> · {row.outcome}{row.status!==null?` · HTTP ${row.status}`:''}</p>
   <p><time dateTime={new Date(row.created).toISOString()}>{date(row.created)}</time> · {row.source}</p>
   <dl><dt>Actor · {row.actor_kind}</dt><dd style={{marginInlineStart:0}}><code>{row.actor_label}</code></dd>
    <dt>Subject · {row.subject_kind}</dt><dd style={{marginInlineStart:0}}><code>{row.subject_label}</code></dd>
    {row.project_label&&<><dt>Project</dt><dd style={{marginInlineStart:0}}><code>{row.project_label}</code></dd></>}
   </dl>
  </li>)}</ol>}
  {page?.next&&<button className="text-button" disabled={busy} onClick={()=>perform(async()=>{const value=await request('/api/audit?cursor='+encodeURIComponent(page.next!));setPage(value);setRows(current=>[...current,...value.rows]);setStatus('Earlier entries loaded.');})}>Load earlier entries</button>}
  {status&&<p role="status">{status}</p>}
 </section>;
}
