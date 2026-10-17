import {plantLegacyAlertMail} from '../legacy-mail.mjs';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {legacyMailRows} from '../legacy-mail.mjs';
import {archiveText} from '../agent-handoff/caps.mjs';
import {canary,organization,importedProject,capProject,mobileProject,sentryExport,sourceMap,event} from './fixture.mjs';

const ingest=(app,project,key,body)=>app.json(`/api/ingest/${project}`,'POST',body,{agent:key});

// The retained-event cap: one project holding 10,000 occurrences, grown through
// a real archive restored into the empty installation (84 live minutes otherwise).
export async function plantCap(app){
 const project=capProject;
 const created=await app.json('/api/projects','POST',{id:project,name:`Cap ${canary.CAP}`});
 await app.json(`/api/projects/${project}/releases`,'POST',{name:'r1',build:'b1'});
 const first=await ingest(app,project,created.ingestKey,event('cap-seed',`Cap ${canary.CAP}`));
 const snapshot=await app.archive(),data=structuredClone(snapshot.data);
 const seed=data.events.find(row=>row.project===project),group=data.issues.find(row=>row.id===first.issue),base=JSON.parse(seed.payload),start=Date.now()-60000;
 data.events=Array.from({length:10000},(_,n)=>{const id='cap-'+String(n).padStart(5,'0'),value={...base,eventId:id};return {...seed,id,payload:JSON.stringify(value),digest:createHash('sha256').update(JSON.stringify(value)).digest('hex'),received:start+n,occurrence:crypto.randomUUID()};});
 group.count=10000;group.first_seen=start;group.last_seen=start+9999;
 await app.resetRestore(await archiveText(snapshot,data));
 const issues=await app.json(`/api/projects/${project}/issues?state=open&limit=1`);assert.equal(issues[0].count,10000,'the cap project holds the retained-event cap');
 return {project,events:10000};
}

// The canary project: created by Sentry organization import, then given native
// capture, a private source map, alert routing, delivery history and a repair.
export async function plantCanary(app){
 const source=Buffer.from(JSON.stringify(sentryExport())).toString('base64'),operationKey='erase-journey';
 const planned=await app.json('/api/imports/sentry/plan','POST',{source,operationKey});assert.equal(planned.counts.rejected,0);
 let job=(await app.json('/api/imports/sentry/apply','POST',{source,reviewedFingerprint:planned.fingerprint,operationKey})).job;
 for(let n=0;n<20&&job.state!=='completed';n++)job=(await app.json(`/api/imports/sentry/${organization}/${job.id}/resume`,'POST')).job;
 assert.equal(job.state,'completed');
 const project=importedProject;assert.ok((await app.json('/api/projects')).some(row=>row.id===project),'import created the canary project');
 for(const [channel,destination] of [['mail','erase-mail'],['webhook','erase-webhook']])await app.json(`/api/projects/${project}/alerting/rules`,'POST',{name:`Erase ${channel}`,enabled:true,channel,destination,kinds:['new_issue'],windowMs:60000,threshold:2});
 const keys={ingest:(await app.json(`/api/projects/${project}/keys`,'POST',{kind:'ingest'})).key,agent:(await app.json(`/api/projects/${project}/keys`,'POST',{kind:'agent'})).key,deploy:(await app.json(`/api/projects/${project}/keys`,'POST',{kind:'deploy'})).key};
 await app.json(`/api/projects/${project}/releases`,'POST',{name:'r1',build:'b1'});
 await app.json(`/api/projects/${project}/artifacts`,'POST',{release:'r1',build:'b1',debugId:'erase-map',map:sourceMap()});
 await app.json(`/api/projects/${project}/browser-origins`,'POST',{origin:'https://canary.example'});
 const ingested=Date.now(),first=await ingest(app,project,keys.ingest,event('erase-title',canary.TITLE));
 await ingest(app,project,keys.ingest,event('erase-event',`Failed ${canary.EVENT}`));
 // The new issue's mail leaves right after ingest; also wait for a minute schedule run after it, which retries
 // the unconfigured webhook, so the later state checks start just after a tick.
 let history=[];
 const ticked=async()=>{const run=(await (await fetch(app.origin+'/health')).json()).alerts?.lastScheduledRun;return !!run&&Date.parse(run)>ingested};
 for(let n=0;n<150;n++){history=await app.json(`/api/projects/${project}/alerting/deliveries`);if(history.some(row=>row.channel==='mail'&&row.state==='accepted')&&history.some(row=>row.channel==='webhook')&&await ticked())break;await delay(1000);}
 assert.ok(history.some(row=>row.channel==='mail'&&row.state==='accepted'),'the local mail alert succeeded without sending');
 await plantLegacyAlertMail(app.checkout.root,project);
 const legacy=await legacyMailRows(app.origin);assert.ok(legacy.some(row=>row.message.includes(canary.RECIPIENT.toLowerCase())),'legacy mail contains the recipient before erasure');
 const repair=await app.json(`/api/projects/${project}/repairs`,'POST',{issue:first.issue,link:'https://github.example/erase/pull/1',note:`Repair ${canary.REPAIR}`});
 const feedbackGrant=await app.json(`/api/projects/${project}/keys`,'POST',{kind:'ingest'}),dsn=new URL(feedbackGrant.dsn);
 await app.json(`/api/${dsn.pathname.slice(1)}/envelope/?sentry_key=${dsn.username}&sentry_version=7`,'POST','{}\n{"type":"feedback"}\n'+JSON.stringify({event_id:'d'.repeat(32),type:'feedback',contexts:{feedback:{message:`Customer report ${canary.FEEDBACK}`}}}));
 return {project,issue:first.issue,keys,repair:repair.id};
}

// A small native project for the 390 erasure.
export async function plantMobile(app){
 const project=mobileProject,created=await app.json('/api/projects','POST',{id:project,name:`Mobile ${canary.MOBILE}`});
 await app.json(`/api/projects/${project}/releases`,'POST',{name:'r1',build:'b1'});
 await ingest(app,project,created.ingestKey,event('mobile-1',`Mobile ${canary.MOBILE}`));
 return {project};
}
