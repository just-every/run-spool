import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {receiver} from './alerts/receiver.mjs';
import {alertRuntime,event,rule,setup} from './alerts/runtime.mjs';
import {suppressionEligibility} from './alerts/suppression-eligibility.mjs';
import {readArchive,makePart} from '../src/modules/portability/index.mjs';
import {ContentVerifier} from '../src/modules/portability/format.mjs';
const temp=await mkdtemp(resolve(tmpdir(),'spool-alert-proof-'));const inbox=await receiver(resolve(temp,'inbox.sqlite'));let app;
const deliveryPath='/api/projects/web/alerting';
try {
 app=await alertRuntime(inbox,{state:resolve(temp,'app')});const auth=await setup(app);
 const mail=await app.json(deliveryPath+'/rules','POST',rule('mail'));
 const webhook=await app.json(deliveryPath+'/rules','POST',rule('webhook'));
 const denied=[
  [deliveryPath+'/rules','POST',rule('webhook'),{Cookie:''}],
  [deliveryPath+'/rules','POST',rule('webhook'),{Origin:'https://attacker.example'}],
  [deliveryPath+'/rules','POST',rule('mail',{destination:'other-v1'}),{}],
 ];for(const args of denied)assert.ok((await app.request(...args)).status>=400);
 const admitted=await app.json('/api/ingest/web','POST',event('first'),auth);
 const duplicate=await Promise.all(Array.from({length:4},()=>app.request('/api/ingest/web','POST',event('first'),auth)));assert.ok(duplicate.every(r=>r.status===200));
 await app.schedule(Date.now());
 let logs=await app.json(deliveryPath+'/deliveries');assert.equal(logs.length,2);assert.ok(logs.some(r=>r.channel==='mail'&&r.state==='accepted'));assert.ok(logs.some(r=>r.channel==='webhook'&&r.state==='accepted'));assert.equal(inbox.effects(),1);
 const outbox=await app.db.prepare("SELECT COUNT(*) n FROM rer_mail_development_outbox WHERE message LIKE '%Spool new issue%'").first();assert.equal(outbox.n,0);
 const payload=JSON.parse(inbox.requests[0].body);assert.equal(payload.issueId,admitted.issue);assert.equal(payload.release.name,'r1');assert.ok(!inbox.requests[0].body.includes('HIDDEN_ALERT_CANARY'));
 for(const secret of ['alert-owner@example.com','synthetic-key-no-provider-call',app.bindings.ALERT_DESTINATION_HASH_KEY])assert.ok(!JSON.stringify(await app.json(deliveryPath+'/destinations')).includes(secret));
 // A forced admission failure rolls back the actual issue/feed/intent transaction.
 await app.db.prepare("CREATE TRIGGER fixture_reject BEFORE INSERT ON events WHEN NEW.id='rollback' BEGIN SELECT RAISE(ABORT,'fixture_failure'); END").run();
 assert.equal((await app.request('/api/ingest/web','POST',event('rollback',{frames:[{file:'https://app.example.com/rollback.js',line:2,column:0,function:'rollback'}]}),auth)).status,503);
 await app.db.prepare('DROP TRIGGER fixture_reject').run();await app.schedule(Date.now());assert.equal((await app.json(deliveryPath+'/deliveries')).length,2);assert.equal(inbox.effects(),1);
 // Receiver authenticates raw bytes and retains replay protection over restart.
 const wire=inbox.requests[0];const send=(body,headers=wire.headers)=>fetch(inbox.url+'/hook',{method:'POST',headers:{...headers,host:new URL(inbox.url).host,'content-length':String(Buffer.byteLength(body))},body});
 assert.equal((await send(wire.body+' ')).status,400);assert.equal((await send(wire.body,{...wire.headers,'webhook-tenant':'spool.other'})).status,400);assert.equal((await send(wire.body,{...wire.headers,'webhook-timestamp':'1'})).status,400);assert.equal((await send(Buffer.from([0x80]))).status,400);
 inbox.restart();assert.equal((await send(wire.body)).status,204);assert.equal(inbox.effects(),1);
 const agent=await app.json('/api/projects/web/keys','POST',{kind:'agent'});
 for(const path of [deliveryPath+'/rules',deliveryPath+'/destinations',deliveryPath+'/deliveries'])assert.ok((await app.request(path,'GET',undefined,{Cookie:'',Authorization:`Bearer ${agent.key}`})).status>=400);
 assert.equal((await app.request('/api/projects/other/alerting/deliveries/'+logs[0].id)).status,404);
 let issue=(await app.json('/api/projects/web/issues'))[0];await app.json('/api/projects/web/issues/'+issue.id,'PATCH',{state:'resolved',revision:issue.revision});
 await app.json('/api/ingest/web','POST',event('old-release'),auth);await app.schedule(Date.now());assert.equal(inbox.effects(),1);
 await app.json('/api/projects/web/releases','POST',{name:'r2',build:'b2'});inbox.statuses.push(429);
 await app.json('/api/ingest/web','POST',event('regressed',{release:'r2',build:'b2'}),auth);await app.schedule(Date.now());
 logs=await app.json(deliveryPath+'/deliveries');const retry=logs.find(r=>r.state==='retrying');assert.ok(retry);const firstAttempt=inbox.requests.at(-1);
 await app.schedule(Date.now()+2100);assert.equal((await app.json(deliveryPath+'/deliveries')).find(r=>r.id===retry.id).state,'accepted');assert.equal(inbox.requests.at(-1).body,firstAttempt.body);assert.equal(inbox.requests.at(-1).headers['webhook-id'],firstAttempt.headers['webhook-id']);assert.notEqual(inbox.requests.at(-1).headers['webhook-timestamp'],firstAttempt.headers['webhook-timestamp']);
 assert.equal(JSON.parse(firstAttempt.body).release.name,'r2');
 await app.json(deliveryPath+'/rules/'+webhook.id,'PUT',rule('webhook',{enabled:false,revision:1}));
 const stale=await app.request(deliveryPath+'/rules/'+webhook.id,'PUT',rule('webhook',{revision:1}));assert.equal(stale.status,409);assert.equal((await app.json(deliveryPath+'/rules')).find(r=>r.id===webhook.id).enabled,0);
 await app.json('/api/ingest/web','POST',event('disabled',{frames:[{file:'https://app.example.com/disabled.js',line:1,column:0,function:'disabled'}]}),auth);const received=inbox.effects();await app.schedule(Date.now());assert.equal(inbox.effects(),received);
 await app.json(deliveryPath+'/rules/'+webhook.id,'PUT',rule('webhook',{revision:2}));inbox.statuses.push(503);
 await app.json('/api/ingest/web','POST',event('uncertain',{frames:[{file:'https://app.example.com/uncertain.js',line:1,column:0,function:'uncertain'}]}),auth);await app.schedule(Date.now());
 const uncertain=(await app.json(deliveryPath+'/deliveries')).find(r=>r.state==='uncertain');assert.ok(uncertain);const attempts=inbox.requests.length;await app.schedule(Date.now()+5000);assert.equal(inbox.requests.length,attempts);
 await app.json(deliveryPath+'/deliveries/'+uncertain.id+'/resolve','POST',{state:'accepted',evidence:'receiver_confirmed'});assert.equal((await app.json(deliveryPath+'/deliveries')).find(r=>r.id===uncertain.id).state,'accepted');
 // Complete-window spikes use accepted server-received evidence and a durable cursor.
 const spike=await app.json(deliveryPath+'/rules','POST',rule('webhook',{name:'Spike',kinds:['spike']}));
 await app.close();app=await alertRuntime(inbox,{state:resolve(temp,'app')});

 // A matching policy retains/counts evidence but contributes neither admission delivery nor a later spike, even after disable.
 const policy=await app.json('/api/projects/web/suppression-policies','POST',{field:'message',mode:'exact',value:'policy quiet',enabled:true});
 const policyFrame={file:'https://app.example.com/policy.js',line:1,column:0,function:'quietPolicy'};
 const priorAlerts=(await app.json('/api/projects/web/alerts')).length,priorIntents=(await app.db.prepare('SELECT COUNT(*) n FROM alert_intents').first()).n;
 const policyIssue=await app.json('/api/ingest/web','POST',event('policy-1',{message:'policy quiet',frames:[policyFrame]}),auth);
 const resolved=(await app.json('/api/projects/web/issues')).find(i=>i.id===policyIssue.issue);await app.json('/api/projects/web/issues/'+resolved.id,'PATCH',{state:'resolved',revision:resolved.revision});
 await app.json('/api/projects/web/releases','POST',{name:'policy-r3',build:'policy-b3'});
 await app.json('/api/ingest/web','POST',event('policy-2',{release:'policy-r3',build:'policy-b3',message:'policy quiet',frames:[policyFrame]}),auth);
 assert.equal((await app.json('/api/projects/web/alerts')).length,priorAlerts,'policy blocks new and later-release regression feed');assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM alert_intents').first()).n,priorIntents,'policy blocks delivery intents');
 const policyPacket=await app.json('/api/projects/web/issues/'+policyIssue.issue+'/packet');assert.equal(policyPacket.issue.count,2);assert.ok(policyPacket.events.every(e=>e.suppression.some(r=>r.id===policy.id)));
 await app.json('/api/projects/web/suppression-policies/'+policy.id,'PATCH',{...policy,enabled:false});
 const start=Math.floor(Date.now()/60000)*60000;
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start-180000,spike.id).run();
 const suppressed=await app.json('/api/ingest/web','POST',event('suppressed-1',{frames:[{file:'https://app.example.com/suppressed.js',line:1,column:0,function:'quiet'}]}),auth);
 await app.json('/api/ingest/web','POST',event('suppressed-2',{frames:[{file:'https://app.example.com/suppressed.js',line:1,column:0,function:'quiet'}]}),auth);
 const quiet=(await app.json('/api/projects/web/issues')).find(i=>i.id===suppressed.issue);await app.json('/api/projects/web/issues/'+quiet.id,'PATCH',{state:'suppressed',revision:quiet.revision});
 await app.json('/api/ingest/web','POST',event('volume-1'),auth);await app.json('/api/ingest/web','POST',event('volume-2'),auth);
 await app.schedule(start+59999);assert.equal((await app.json('/api/projects/web/alerts')).filter(a=>a.kind==='spike').length,0);
 await Promise.all([app.schedule(start+60000),app.schedule(start+60000)]);
 const spikes=(await app.json('/api/projects/web/alerts')).filter(a=>a.kind==='spike');assert.equal(spikes.length,1);assert.ok(spikes.every(a=>a.issue!==policyIssue.issue),'previously suppressed events cannot spike after disable');assert.ok(JSON.parse(spikes[0].payload).window.count>=2);assert.equal((await app.db.prepare('SELECT next_start FROM alert_cursors WHERE rule_id=?').bind(spike.id).first()).next_start,start+60000);
 await app.db.prepare('UPDATE alert_cursors SET next_start=? WHERE rule_id=?').bind(start,spike.id).run();
 await app.json('/api/projects/web/retention','POST',{cutoff:Date.now(),apply:true});assert.equal((await app.json(deliveryPath+'/gaps')).length,1);
 await suppressionEligibility(app,auth,event,deliveryPath);

 // Native portability carries safe, disabled rules and inert history, never queues or secrets.
 const exported=await app.request('/api/archive');assert.equal(exported.status,200);const archive=await exported.text(),records=[];for await(const r of readArchive(new Response(archive).body))records.push(r);
 for(const canary of ['HIDDEN_ALERT_CANARY','alert-owner@example.com',app.bindings.ALERT_DESTINATION_HASH_KEY])assert.ok(!archive.includes(canary));
 const rows=records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(r=>r.kind==='row');assert.ok(rows.filter(i=>i.table==='alert_rules').every(i=>i.row.enabled===0));assert.ok(rows.filter(i=>i.table==='alert_history').every(i=>i.row.historical===1));
 const poison=structuredClone(records),part=poison.find(r=>r.kind==='part'&&r.items.some(i=>i.table==='alert_rules'));part.items.find(i=>i.table==='alert_rules').row.project='other';Object.assign(part,await makePart(part.index,part.items));const verifier=new ContentVerifier(poison[0]);for(const p of poison.filter(r=>r.kind==='part'))for(const item of p.items)verifier.add(item);poison.at(-1).contentHash=verifier.digest();
 const sends=inbox.requests.length;await app.close();app=await alertRuntime(inbox);
 assert.ok((await app.request('/api/restore','POST',poison.map(r=>JSON.stringify(r)).join('\n')+'\n',{'X-Confirm-Restore':'yes'})).status>=400);
 assert.equal((await app.request('/api/restore','POST',archive,{'X-Confirm-Restore':'yes'})).status,200);
 await app.schedule(Date.now()+120000);assert.equal(inbox.requests.length,sends);assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM alert_mail_jobs').first()).n,0);assert.ok((await app.json(deliveryPath+'/rules')).every(r=>!r.enabled));
 const restoredRule=(await app.json(deliveryPath+'/rules')).find(r=>r.id===webhook.id);await app.json(deliveryPath+'/rules/'+webhook.id,'PUT',rule('webhook',{revision:restoredRule.revision}));await app.schedule(Date.now());assert.equal(inbox.requests.length,sends);
 const key=await app.json('/api/projects/web/keys','POST',{kind:'ingest'});await app.json('/api/ingest/web','POST',event('post-restore',{frames:[{file:'https://app.example.com/after.js',line:1,column:0,function:'after'}]}),{Authorization:`Bearer ${key.key}`});await app.schedule(Date.now());assert.equal(inbox.requests.length,sends+1);
 const session=app.cookie;await app.request('/auth/signout','POST',{});assert.ok((await app.request(deliveryPath+'/rules','GET',undefined,{Cookie:session})).status>=400);
 console.log('Alert public doors passed: atomic capture with silent local mail and HMAC receiver; regression, isolation/revocation/origin, immutable 429 retry, uncertainty, overlapping complete-window spikes, safe restore without replay.');
} finally {await app?.close();await inbox.close();await rm(temp,{recursive:true,force:true});}
