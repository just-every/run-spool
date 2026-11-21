import { EmailAlert } from './EmailAlert';
import { plural } from '../workbench/readable';
import {AlertControls} from './AlertControls';
import {NeedsAttention} from './NeedsAttention';
import { useEffect, useState } from 'react';
import { AlertRules } from './AlertRules';
import { AlertDestinations } from './AlertDestinations';
import { AlertDeliveries } from './AlertDeliveries';
import { alertApi, date, status } from './client';
import { useDraft } from '../workbench/shared';
import './alerts.css';
export function Alerts({project,onIssue}:{project:string;onIssue:(id:string)=>void}) {
 const [tab,setTab]=useDraft(`${project}.alert-tab`,'feed'),[data,setData]=useState<any>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const refresh=()=>setRevision(r=>r+1);
 function destinationReviewed(destination:string,testId:string,reviewedAt:number){
  setData((current:any)=>current?.project===project?{
   ...current,destinations:{...current.destinations,rows:current.destinations.rows.map((row:any)=>
    row.id===destination&&row.test?.id===testId?{...row,test:{...row.test,reviewed_at:reviewedAt}}:row)},
  }:current);
  refresh();
 }
 useEffect(()=>{let live=true;setData((current:any)=>current?.project===project?current:null);setError('');Promise.all([alertApi(`/api/projects/${project}/alerts`),alertApi(`/api/projects/${project}/alerting/rules`),alertApi(`/api/projects/${project}/alerting/destinations`),alertApi(`/api/projects/${project}/alerting/deliveries`),alertApi(`/api/projects/${project}/alerting/gaps`)]).then(([feed,rules,destinations,deliveries,gaps])=>live&&setData({project,feed,rules,destinations,deliveries,gaps})).catch(e=>live&&setError(e.message));return()=>{live=false}},[project,revision]);
 const ready=data?.project===project;
 return <div className="alerts-view"><nav className="alert-tabs" aria-label="Alert views">{[['feed','Alert feed'],['rules','Rules'],['deliveries','Delivery log'],['attention','Needs attention'],['controls','Digests and snoozes']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}<button className="text-button" onClick={refresh}>Refresh alerts</button></nav>
 {error?<p className="callout" role="alert">{error}</p>:!ready?<p role="status">Loading saved alerts…</p>:<>
 {tab==='feed'&&<section className="evidence"><h2>Alert feed</h2><p>New issues, regressions, reactivations and configured window alerts from accepted evidence.</p>{!data.feed.length?<p>No alert facts have been recorded for this project.</p>:<ul className="alert-records">{data.feed.map((row:any)=>{const payload=row.payload?JSON.parse(row.payload):null;return <li key={row.id}><div><strong>{status(row.kind)}</strong><p>{payload?.title??'Issue evidence'}</p><p>{date(row.created)}{payload?.release?` · release ${payload.release.name}`:''}</p>{payload?.metric&&<p>{payload.metric.reason} · {payload.metric.from} → {payload.metric.to}</p>}{payload?.window&&!payload?.metric&&<p>{payload.window.count} accepted occurrences / {payload.window.durationMs/60000} minutes; threshold {payload.window.threshold}</p>}<p>{row.delivery_count?`${row.delivery_count} delivery ${plural(row.delivery_count, 'intent')}`:<>Nobody was told. <button className="text-button" onClick={()=>setTab('rules')}>Add an email alert</button></>}</p></div>{row.issue&&<button className="text-button" onClick={()=>onIssue(row.issue)}>Open issue</button>}</li>})}</ul>}{data.gaps.map((gap:any)=><p className="callout" key={gap.id}>Spike history unavailable after retention at {date(gap.created)}. A partial window was skipped.</p>)}</section>}
 {tab==='rules'&&<><EmailAlert key={project+'-email'} project={project} refresh={refresh} mailSuppressed={!!data.destinations.mailSuppressed}/><details><summary>Details</summary><AlertDestinations key={project+'-destinations'} project={project} rows={data.destinations.rows} configuration={data.destinations.configuration} refresh={refresh} onReviewed={destinationReviewed}/><AlertRules key={project} project={project} rules={data.rules} destinations={data.destinations.rows} refresh={refresh}/></details></>}
 {tab==='controls'&&<AlertControls key={project} project={project} feed={data.feed} rules={data.rules} destinations={data.destinations.rows.filter((d:any)=>d.kind!=='target')}/>}
 {tab==='attention'&&<NeedsAttention onControls={()=>setTab('controls')} key={project} project={project} destinations={data.destinations.rows.filter((d:any)=>d.kind!=='target')}/>}
 {tab==='deliveries'&&<AlertDeliveries key={project} project={project} rows={data.deliveries} refresh={refresh}/>}
 </>}
 </div>;
}
