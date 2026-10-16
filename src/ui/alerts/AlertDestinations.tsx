import { useState } from 'react';
import { Field } from '../workbench/shared';
import { alertApi } from './client';

export function AlertDestinations({project,rows,configuration,refresh}:{project:string;rows:any[];configuration:string;refresh:()=>void}) {
 const [editing,setEditing]=useState<string|null>(null),[label,setLabel]=useState(''),[recipient,setRecipient]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 function clear(){setEditing(null);setLabel('');setRecipient('')}
 async function save(){setBusy(true);setError('');setMessage('');try{await alertApi(`/api/projects/${project}/alerting/destinations${editing?'/'+editing:''}`,editing?'PUT':'POST',{label,recipient});setMessage(editing?'Destination updated. Its rules now use the new address; queued work for the previous address was stopped.':'Destination added. Test it below, then choose it in a rule.');clear();refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function test(id:string){setBusy(true);setError('');setMessage('');try{const result=await alertApi(`/api/projects/${project}/alerting/destinations/${id}/test`,'POST',{});setMessage(result.message)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="evidence"><h2>Alert destinations</h2><p>Add an email address, test delivery, then select it in a rule below. Destinations belong only to this project. <a href="https://github.com/just-every/run-spool/blob/main/docs/ALERT-WEBHOOKS.md#manage-email-destinations">Destination setup guide</a></p>
 {configuration==='blocked'&&<p className="callout" role="alert">This installation’s server destination configuration is invalid. Its operator must correct ALERT_DESTINATIONS before rules can deliver.</p>}
 {!rows.length?<p>No destinations yet. Add your first email destination below.</p>:<ul className="alert-records">{rows.map(row=><li key={row.id}><div><strong>{row.label}</strong><p>{row.channel==='mail'?'Email':'Signed webhook'}{row.recipient?` · ${row.recipient}`:''}</p>{!row.configured&&<p className="callout">Delivery is blocked: this installation needs {row.channel==='mail'?'a working mail provider and alert destination hash key':'a signed webhook egress service and alert destination hash key'}.</p>}{!row.editable&&<p className="muted">Managed by this installation’s operator. Add an email destination below to manage it here.</p>}</div>{row.editable&&<div className="button-row"><button className="text-button" disabled={busy} onClick={()=>{setEditing(row.id);setLabel(row.label);setRecipient(row.recipient);setError('');setMessage('')}}>Edit {row.label}</button><button className="text-button" disabled={busy||!row.configured} onClick={()=>void test(row.id)}>Test {row.label}</button></div>}</li>)}</ul>}
 <h3>{editing?'Edit email destination':'Add email destination'}</h3><form className="form-grid" onSubmit={e=>{e.preventDefault();void save()}}>
 <Field label="Destination name" required maxLength={100} value={label} onChange={e=>setLabel(e.target.value)} placeholder="On-call team"/>
 <Field label="Destination email" type="email" required value={recipient} onChange={e=>setRecipient(e.target.value)} autoComplete="email"/>
 <p className="muted">Email addresses stay in this installation and are excluded from private archives. Changing an address updates its rules and stops queued deliveries to the old address. A send already in progress cannot be retracted. Local development suppresses all email, including tests. Webhooks require operator setup in the guide.</p>
 <div><button className="primary-button" disabled={busy}>{busy?'Working…':editing?'Save destination':'Add destination'}</button>{editing&&<button className="text-button" type="button" disabled={busy} onClick={clear}>Cancel destination edit</button>}</div></form>
 {error&&<p className="callout" role="alert">{error}</p>}{message&&<p className="callout" role="status">{message}</p>}</section>;
}
