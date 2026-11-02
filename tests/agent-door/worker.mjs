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
 const jobs=(await app.DB.prepare('SELECT id,state FROM alert_mail_jobs WHERE project=?').bind(project).all()).results;assert.ok(jobs.length,'Native capture created real durable delivery jobs');
 await app.adopt();await app.schedule(Date.now()+180000);
 const delivered=(await app.mail()).filter(message=>message.text?.includes('StandingNativeFirst'));
 assert.ok(delivered.length,'A resumed native worker executes through its retained admission');
 assert.ok(delivered.every(message=>message.text.includes('Prepared by Agent door conformance for Dana Engineer.')),'Standing effects retain the originating native actor');
 await capture('StandingNativeStopped');
 return {async stopped(){const count=(await app.mail()).length;await app.schedule(Date.now()+240000);assert.equal((await app.mail()).length,count,'Detached Business authority cannot execute queued standing mail');assert.ok(!(await app.mail()).some(message=>message.text?.includes('StandingNativeStopped')));console.log('Native standing worker: durable real jobs; Pause no-send; resumed attributed delivery; detached Business no-send.');}};
}
