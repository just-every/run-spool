import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
export async function nativeWorker(app,{project,ingestKey,destination}){
 const done=answer=>{assert.ok(!answer.isError,answer?._meta?.['com.runeditrun/error']?.code);return answer.structuredContent;};
 await app.adopt();
 const config={name:'Native standing admission',enabled:false,channel:'mail',destination,kinds:['new_issue'],windowMs:60000,threshold:2};
 const created=await app.json(`/api/projects/${project}/alerting/rules`,'POST',config);
 const current=(await app.json(`/api/projects/${project}/alerting/rules`)).find(row=>row.id===created.id);
 const args={project,id:created.id,...config,enabled:true,revision:current.revision};
 const preview=done(await app.call('spool.alerts.preview',{...args,idempotency_key:randomUUID()}));
 done(await app.call('spool.alerts.update',{...args,previewToken:preview.token,idempotency_key:randomUUID()}));
 const capture=async name=>app.json('/api/ingest/'+project,'POST',{version:1,eventId:randomUUID(),release:'1.0.0',build:'web-1',environment:'production',type:name,message:name,frames:[{file:'https://checkout.example/worker.js',line:1,column:0,function:name}],breadcrumbs:[]},{Authorization:'Bearer '+ingestKey});
 await capture('StandingNativeFirst');
 await app.adopt(autonomousPolicy(),{paused:true});
 const before=(await app.mail()).length;
 await app.schedule(Date.now()+120000);
 assert.equal((await app.mail()).length,before,'Pause stops the real agent-configured worker before mail');
 const jobs=(await app.DB.prepare('SELECT j.id,j.state FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id WHERE i.rule_id=?').bind(created.id).all()).results;assert.ok(jobs.length,'Native capture created real durable delivery jobs');
 await app.adopt();await app.schedule(Date.now()+180000);
 const delivered=(await app.mail()).filter(message=>jobs.some(job=>job.id===message.deliveryId));
 assert.equal(delivered.length,1,'A resumed native worker executes through its retained admission');
 assert.ok(delivered.every(message=>message.text.includes('Prepared by Agent door conformance for Dana Engineer.')),'Standing effects retain the originating native actor');
 assert.ok(delivered.every(message=>/^Agent door conformance for Dana Engineer <[^<>]+>$/.test(message.from)),'The queued provider payload names its retained agent and sponsor as sender');
 console.log('PROBE BASE-AGENT-008 acceptance-7: native destination test and resumed standing mail -> provider payload sender names Agent door conformance for Dana Engineer; Pause and detach prevent sends');
 // Invalid public intake creates a real capture-loss attention item. Its
 // agent-configured alternate uses the same retained actor at the mail edge.
 done(await app.call('spool.followups.update',{project,destination,channel:'mail',idempotency_key:randomUUID()}));
 const invalid=await app.request('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-invalid'},{Cookie:'',Authorization:'Bearer '+ingestKey});
 assert.equal(invalid.status,400);await invalid.body?.cancel();
 await app.schedule(Date.now()+210000);
 const attention=(await app.json('/api/projects/'+project+'/follow-up')).rows.find(row=>row.reason==='capture_loss_invalid');
 assert.ok(attention,'Public refusal produces populated native follow-up work');
 assert.ok(attention.notices.some(notice=>notice.state==='completed'),'The configured alternate notice completes');
 const notice=(await app.mail()).find(message=>message.subject==='Spool needs attention'&&message.text.includes(attention.id));
 assert.ok(notice,'The follow-up crosses the real provider edge');
 assert.match(notice.from,/^Agent door conformance for Dana Engineer <[^<>]+>$/,'Follow-up sender retains the configuring agent and sponsor');
 done(await app.call('spool.followups.update',{project,destination:null,idempotency_key:randomUUID()}));
 console.log('PROBE BASE-AGENT-008 acceptance-7-followup: authorized invalid intake -> native attention and one completed alternate notice with agent and sponsor sender');
 await app.adopt(autonomousPolicy(),{paused:true});await capture('StandingNativeStopped');
 return {async stopped(){const count=(await app.mail()).length;await app.schedule(Date.now()+240000);assert.equal((await app.mail()).length,count,'Detached Business authority cannot execute queued standing mail');assert.ok(!(await app.mail()).some(message=>message.text?.includes('StandingNativeStopped')));console.log('Native standing worker: durable real jobs; Pause no-send; resumed attributed delivery; detached Business no-send.');}};
}
