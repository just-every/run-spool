import { useState } from 'react';
import { alertApi, date, status } from './client';
import { Details } from '../workbench/Details';
import { Field, useDraft } from '../workbench/shared';
export function AlertDeliveries({project,rows,refresh}:{project:string;rows:any[];refresh:()=>void}) {
 return <section className="evidence"><h2>Delivery log</h2><p>Captured locally means the development outbox saved the message. Accepted means receiver or provider submission, not human acknowledgment. Only definite rate limits retry automatically.</p>
 {!rows.length?<p>No delivery intents have been recorded.</p>:<ul className="alert-records">{rows.map(row=><Delivery key={row.id} project={project} row={row} refresh={refresh}/>)}</ul>}</section>;
}
function Delivery({project,row,refresh}:{project:string;row:any;refresh:()=>void}) {
 const [detail,setDetail]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [evidence,setEvidence]=useDraft(`${project}.delivery.${row.id}.evidence`,'');
 async function inspect(){setError('');try{setDetail(await alertApi(`/api/projects/${project}/alerting/deliveries/${row.id}`))}catch(e){setError((e as Error).message)}}
 async function resolve(state:string){setBusy(true);setError('');try{await alertApi(`/api/projects/${project}/alerting/deliveries/${row.id}/resolve`,'POST',{state,evidence});setEvidence('');await inspect();refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <li><div><strong className="tag">{status(row.state)}</strong>{row.historical===1&&<span> · restored history, quarantined</span>}<p>{row.channel==='mail'?'Email':'Webhook'} · {row.attempts} {row.attempts===1?'attempt':'attempts'}</p><p><time>{date(row.created)}</time></p></div>
 <Details title={`Delivery ${date(row.created)}`} onOpen={()=>void inspect()}>
 {error&&<p role="alert" className="callout">{error}</p>}{!detail?<p role="status">{error?'Delivery details could not be loaded.':'Loading delivery details…'}</p>:<><p>{status(detail.delivery.state)}</p><ol>{detail.attempts.map((attempt:any)=><li key={attempt.number}>Attempt {attempt.number}: {status(attempt.outcome?.code??attempt.code??'awaiting_result')} · {date(attempt.startedAt??attempt.started)}</li>)}</ol>
 {detail.delivery.state==='uncertain'&&!detail.delivery.historical&&<form onSubmit={event=>event.preventDefault()}><p>Check the receiver or provider before reconciling. Recording the observed outcome never sends again.</p><Field label="Evidence code" required pattern="[a-z][a-z0-9_]{0,63}" value={evidence} onChange={event=>setEvidence(event.target.value)} placeholder="receiver_confirmed"/><div className="button-row"><button type="button" className="primary-button" disabled={busy||!/^[a-z][a-z0-9_]{0,63}$/.test(evidence)} onClick={()=>void resolve('accepted')}>Record accepted</button><button type="button" className="text-button" disabled={busy||!/^[a-z][a-z0-9_]{0,63}$/.test(evidence)} onClick={()=>void resolve('rejected')}>Record rejected</button></div></form>}
 <h3>Saved delivery facts</h3><pre>{JSON.stringify(detail,null,2)}</pre></>}
 <button className="text-button" disabled={busy} onClick={()=>void inspect()}>Refresh delivery</button>
 </Details></li>;
}
