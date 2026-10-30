import { useEffect, useState } from 'react';
import { notificationTypes, type EmailPreferences } from '../../domain/notifications/types';
import type { Request, Run } from './shared';

const labels = {resolution:'Resolutions',regression:'Regressions',assignment:'Assignments',comment:'Comments',mention:'Mentions',issue_alert:'Issue alerts',deploy:'Deploys',weekly_report:'Weekly reports'};
type Preferences = {email:EmailPreferences;revision:number;updated:number|null};
export function PersonalNotifications({project,request,run,busy,canManage=false}:{canManage?:boolean;project:string;request:Request;run:Run;busy:boolean}) {
 const root = `/api/projects/${encodeURIComponent(project)}/notifications/preferences`;
 const [current,setCurrent] = useState<Preferences|null>(null),[draft,setDraft] = useState<EmailPreferences|null>(null),[error,setError] = useState(''),[status,setStatus] = useState('');
 async function load() {const row = await request(root);setCurrent(row);setDraft(row.email);setError('');}
 useEffect(() => {let alive = true;request(root).then(row => {if(alive){setCurrent(row);setDraft(row.email);}}).catch(e => {if(alive)setError(e.message);});return () => {alive = false;};},[root,request]);
 return <section className="evidence" aria-labelledby="personal-notifications-title"><h2 id="personal-notifications-title">Personal notifications</h2>
  <p>Your email choices for this project. Weekly reports start off. Email follows these choices. Workflow mail goes to issue subscribers except the actor. Deploy mail matches your recorded commit address. Weekly reports start at Monday 09:00 UTC; your calendar schedule below can change the timezone and hour. Each message has an unsubscribe link.</p>
  {error && <p role="alert">{error} <button className="text-button" disabled={busy} onClick={() => void run(load)}>Reload saved preferences</button></p>}
  {!draft ? !error && <p role="status">Loading your preferences…</p> : <form onSubmit={event => {event.preventDefault();void run(async() => {
   try {setError('');setStatus('');const row = await request(root,'PUT',{revision:current!.revision,email:draft});setCurrent(row);setDraft(row.email);setStatus('Your email preferences are saved.');}
   catch(e) {setError((e as Error).message);}
  });}}>
   <fieldset disabled={busy}><legend>Email preferences</legend>
    {notificationTypes.map(type => <label className="checkbox" key={type}><input type="checkbox" checked={draft[type]} onChange={event => {setDraft({...draft,[type]:event.target.checked});setStatus('');}} />{labels[type]}</label>)}
   </fieldset>
   <button className="primary-button" type="submit" disabled={busy || JSON.stringify(draft) === JSON.stringify(current?.email)}>Save email preferences</button>
   {status && <p role="status">{status}</p>}
  </form>}
  <PersonalDigest {...{root,request,run,busy}} />
  <MandatoryRules {...{root,request,run,busy,canManage}} />
 </section>;
}

type Digest = {timezone:string;hour:number;daily:boolean;weekly:boolean;revision:number};
function PersonalDigest({root,request,run,busy}:{root:string;request:Request;run:Run;busy:boolean}) {
 const [saved,setSaved]=useState<Digest|null>(null),[draft,setDraft]=useState<Digest|null>(null),[error,setError]=useState(''),[status,setStatus]=useState('');
 useEffect(()=>{let active=true;request(root.replace(/preferences$/,'digest')).then(row=>{if(active){setSaved(row);setDraft(row)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[root,request]);
 return <><h3>Personal email digests</h3>{error&&<p role="alert">{error}</p>}{draft&&<form onSubmit={event=>{event.preventDefault();void run(async()=>{try{const row=await request(root.replace(/preferences$/,'digest'),'PUT',draft);setSaved(row);setDraft(row);setError('');setStatus('Your digest schedule is saved.')}catch(e){setError((e as Error).message)}})}}>
  <fieldset disabled={busy}><legend>Calendar schedule</legend>
   <label className="form-field">Timezone<input aria-label="Digest timezone" required value={draft.timezone} onChange={event=>setDraft({...draft,timezone:event.target.value})}/></label>
   <label className="form-field">Local delivery hour<input aria-label="Digest delivery hour" required type="number" min={0} max={23} value={draft.hour} onChange={event=>setDraft({...draft,hour:Number(event.target.value)})}/></label>
   <label className="checkbox"><input type="checkbox" checked={draft.daily} onChange={event=>setDraft({...draft,daily:event.target.checked})}/>Daily email digest</label>
   <label className="checkbox"><input type="checkbox" checked={draft.weekly} onChange={event=>setDraft({...draft,weekly:event.target.checked})}/>Weekly email digest</label>
  </fieldset>
  <p>Each enabled digest covers one completed calendar period in your timezone, including capture loss and the retained backlog. Weekly reports use this timezone and hour too. Email is the available personal channel.</p>
  <button className="primary-button" disabled={busy||JSON.stringify(saved)===JSON.stringify(draft)}>Save digest schedule</button>{status&&<p role="status">{status}</p>}
 </form>}</>;
}

function MandatoryRules({root,request,run,busy,canManage}:{root:string;request:Request;run:Run;busy:boolean;canManage:boolean}) {
 const [rows,setRows]=useState<any[]>([]),[error,setError]=useState('');
 const path=root.replace(/preferences$/,'mandatory-rules');
 useEffect(()=>{let active=true;request(path).then(value=>{if(active)setRows(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[path,request]);
 return <><h3>Required email rules</h3><p>Only an organization administrator can require rule delivery. Your issue-alert checkbox controls optional personal email.</p>{error&&<p role="alert">{error}</p>}{!rows.length?<p>No project alert rules.</p>:rows.map(row=><label className="checkbox" key={row.id}><input type="checkbox" checked={!!row.mandatory} disabled={busy||!canManage} onChange={event=>{const mandatory=event.target.checked;void run(async()=>{try{await request(path+'/'+encodeURIComponent(row.id),'PUT',{revision:row.revision,mandatory});setRows(await request(path));setError('')}catch(e){setError((e as Error).message)}})}}/>{row.name}{row.enabled?'':' (disabled)'}</label>)}</>;
}
