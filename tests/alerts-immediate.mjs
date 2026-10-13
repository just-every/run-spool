import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
// New-issue and regression alerts leave right after ingest, without waiting for the cron, and the cron never sends them again.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {receiver} from './alerts/receiver.mjs';
import {alertRuntime,event,rule,setup} from './alerts/runtime.mjs';
const temp=await mkdtemp(resolve(tmpdir(),'spool-alert-immediate-'));const inbox=await receiver(resolve(temp,'inbox.sqlite'));let app;
const deliveries='/api/projects/web/alerting/deliveries';
const frames=name=>({frames:[{file:`https://app.example.com/${name}.js`,line:1,column:0,function:name}]});
try {
 app=await alertRuntime(inbox);const auth=await setup(app);
 const sent=kind=>async()=>(await app.db.prepare("SELECT COUNT(*) n FROM rer_mail_development_outbox WHERE message LIKE ?").bind(`%Spool ${kind}%`).first()).n;
 const mails=sent('new issue'),regressionMails=sent('regression');
 const settled=async(mail,effects,count=mails)=>{for(let i=0;i<100;i++){if(await count()>=mail&&inbox.effects()>=effects)return;await new Promise(r=>setTimeout(r,50))}};
 const health=async()=>(await (await fetch(app.origin+'/health')).json()).alerts.lastScheduledRun;
 // An idle tick leaves its time where /health shows it.
 assert.equal(await health(),null);
 await app.schedule(Date.now());const idle=await health();assert.ok(idle&&Date.parse(idle)>0,'an idle scheduled run is recorded');
 await app.json('/api/projects/web/alerting/rules','POST',rule('mail'));await app.json('/api/projects/web/alerting/rules','POST',rule('webhook'));
 // Ingest alone delivers both channels; no scheduled run happens in between.
 const started=Date.now(),first=await app.json('/api/ingest/web','POST',event('first',frames('first')),auth);await settled(1,1);
 assert.equal(await mails(),1);assert.equal(inbox.effects(),1);assert.equal(await health(),idle,'no scheduled run was needed');
 const states=(await app.json(deliveries)).map(row=>row.state).sort();assert.deepEqual(states,['accepted','captured_locally']);
 // The cron racing the dispatch after ingest, and every later tick, sends nothing twice.
 await Promise.all([app.json('/api/ingest/web','POST',event('second',frames('second')),auth),app.schedule(Date.now()),app.schedule(Date.now()),app.schedule(Date.now())]);
 await settled(2,2);for(let i=0;i<3;i++)await app.schedule(Date.now()+i*1000);
 assert.equal(await mails(),2);assert.equal(inbox.effects(),2);assert.equal(inbox.requests.length,2);
 assert.equal((await app.json(deliveries)).length,4);
 // A resolved issue seen again in a later release: its regression alert also leaves at ingest, and only once.
 const issue=(await app.json('/api/projects/web/issues')).find(row=>row.id===first.issue);
 await app.json('/api/projects/web/issues/'+issue.id,'PATCH',{state:'resolved',revision:issue.revision});await app.json('/api/projects/web/releases','POST',{name:'r2',build:'b2'});
 const lastTick=await health();
 await app.json('/api/ingest/web','POST',event('regressed',{...frames('first'),release:'r2',build:'b2'}),auth);await settled(1,3,regressionMails);
 assert.equal(await regressionMails(),1);assert.equal(inbox.effects(),3);assert.equal(await health(),lastTick,'no scheduled run was needed for the regression');
 for(let i=0;i<3;i++)await app.schedule(Date.now()+i*1000);
 assert.equal(await regressionMails(),1);assert.equal(inbox.effects(),3);assert.equal(inbox.requests.length,3);
 console.log(JSON.stringify({passed:true,ingestToDeliveredMs:Date.now()-started,proof:'Idle tick recorded in /health; new-issue and regression mail and webhook sent after ingest with no scheduled run; racing and later scheduled runs sent nothing twice.'}));
} finally {await app?.close();await inbox.close?.();await rm(temp,{recursive:true,force:true});}
