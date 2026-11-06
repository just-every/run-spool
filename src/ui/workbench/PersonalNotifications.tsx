import { useEffect, useState } from 'react';
import { notificationTypes, type EmailPreferences } from '../../domain/notifications/types';
import type { Request, Run } from './shared';

const labels = {resolution:'Resolutions',regression:'Regressions',assignment:'Assignments',comment:'Comments',mention:'Mentions',issue_alert:'Issue alerts',deploy:'Deploys',weekly_report:'Weekly reports'};
type Preferences = {email:EmailPreferences;revision:number;updated:number|null};
export function PersonalNotifications({project,request,run,busy}:{project:string;request:Request;run:Run;busy:boolean}) {
 const root = `/api/projects/${encodeURIComponent(project)}/notifications/preferences`;
 const [current,setCurrent] = useState<Preferences|null>(null),[draft,setDraft] = useState<EmailPreferences|null>(null),[error,setError] = useState(''),[status,setStatus] = useState('');
 async function load() {const row = await request(root);setCurrent(row);setDraft(row.email);setError('');}
 useEffect(() => {let alive = true;request(root).then(row => {if(alive){setCurrent(row);setDraft(row.email);}}).catch(e => {if(alive)setError(e.message);});return () => {alive = false;};},[root,request]);
 return <section className="evidence" aria-labelledby="personal-notifications-title"><h2 id="personal-notifications-title">Personal notifications</h2>
  <p>Your email choices for this project. Weekly reports start off. These preferences are saved for your account; personal notification delivery is not connected yet.</p>
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
 </section>;
}
