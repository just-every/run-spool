import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {readArchive} from '../../src/modules/portability/index.mjs';
import {alertRuntime,setup,event,rule,testAndReview} from './runtime.mjs';
export function providerSigner(){
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 return {key:publicKey.export({type:'spki',format:'der'}).toString('base64'),sign(events){const body=JSON.stringify(events),timestamp=String(Math.floor(Date.now()/1000));return {body,headers:{'x-twilio-email-event-webhook-timestamp':timestamp,'x-twilio-email-event-webhook-signature':sign('sha256',Buffer.from(timestamp+body),privateKey).toString('base64')}}}};
}
async function projection(app){const records=[];for await(const r of readArchive((await app.request('/api/archive')).body))records.push(r);return records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(i=>i.kind==='row').sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
export async function deliveryFlow(inbox){
 const signer=providerSigner(),state=await mkdtemp(join(tmpdir(),'spool-delivery-restart-'));let app;
 try{
  app=await alertRuntime(inbox,{state,mail:'sendgrid',extraBindings:{SENDGRID_EVENT_PUBLIC_KEY:signer.key,ALERT_EVENT_PROVENANCE:'fixture'}});const auth=await setup(app),base='/api/projects/web/alerting';
  // Fresh untested destinations cannot enable. A passing result needs explicit review.
  const d=await app.json(base+'/destinations','POST',{label:'Destination check',recipient:'fixture@example.com'});
  assert.equal((await app.request(base+'/rules','POST',rule('mail',{destination:d.id}))).status,400);
  const before=await projection(app),test=await app.json(base+'/destinations/'+d.id+'/test','POST',{});
  assert.equal(test.state,'passing');assert.deepEqual(await projection(app),before,'test send preserves the complete archive row projection');
  assert.equal((await app.request(base+'/rules','POST',rule('mail',{destination:d.id}))).status,400);
  await app.json(base+'/destinations/'+d.id+'/review','POST',{testId:test.id});
  const mailRule=await app.json(base+'/rules','POST',rule('mail',{destination:d.id}));
  const created=await app.json('/api/ingest/web','POST',event('delivery-fixture'),auth);
  let delivery=(await app.json(base+'/deliveries')).find(r=>r.channel==='mail');assert.equal(delivery.state,'accepted');assert.equal(delivery.recipient_state,null);
  let timestamp=Math.floor(Date.now()/1000)-5;
  const provider=(type,id=crypto.randomUUID(),extra={})=>({email:'fixture@example.com',sg_event_id:id,sg_message_id:'signed-fixture-message',timestamp:timestamp++,event:type,rer_delivery_id:delivery.id,...extra});
  const send=async events=>{const signed=signer.sign(events);return app.request('/api/alert-events/sendgrid/web','POST',signed.body,signed.headers)};
  const delivered=provider('delivered');assert.equal((await send([delivered])).status,200);
  delivery=(await app.json(base+'/deliveries')).find(r=>r.id===delivery.id);assert.equal(delivery.state,'accepted');assert.equal(delivery.recipient_state,'delivered');
  assert.equal((await send([provider('bounce')])).status,200);assert.equal((await app.json(base+'/deliveries')).find(r=>r.id===delivery.id).recipient_state,'bounced');
  const complaint=provider('spamreport');assert.equal((await send([complaint])).status,200);assert.equal((await app.json(base+'/deliveries')).find(r=>r.id===delivery.id).recipient_state,'complained');
  const count=async table=>(await app.db.prepare('SELECT COUNT(*) n FROM '+table).first()).n;
  const total=await count('alert_provider_events');await Promise.all([send([complaint]),send([complaint])]);assert.equal(await count('alert_provider_events'),total);
  const receipts=await count('rer_mail_event_receipts'),auditRows=await count('spool_audit_events');assert.equal((await app.request('/api/alert-events/sendgrid/web','POST',[provider('delivered')])).status,403);
  const forged=signer.sign([provider('bounce')]);forged.headers['x-twilio-email-event-webhook-signature']='AAAA';assert.equal((await app.request('/api/alert-events/sendgrid/web','POST',forged.body,forged.headers)).status,403);
  assert.equal((await send([provider('delivered',crypto.randomUUID(),{rer_delivery_id:'unknown'})])).status,403);assert.equal(await count('rer_mail_event_receipts'),receipts);assert.equal(await count('spool_audit_events'),auditRows,'unsigned, forged and unknown inbound events make no write');
  const timeline=await app.json(base+'/deliveries/'+delivery.id);assert.deepEqual(timeline.events.map(e=>e.state),['delivered','bounced','complained']);assert.ok(timeline.events.every(e=>e.provenance==='fixture'));
  assert.equal((await send([provider('deferred')])).status,200);assert.ok((await app.json(base+'/deliveries/'+delivery.id)).events.some(e=>e.state==='deferred'));assert.equal((await send([provider('dropped')])).status,200);assert.equal((await app.json(base+'/deliveries')).find(r=>r.id===delivery.id).recipient_state,'dropped');
  const webhook=await app.json(base+'/rules','POST',rule('webhook'));
  // Rule and issue snoozes retain the actual outbound intents during a burst.
  inbox.mailStatuses.push(429);await app.json('/api/ingest/web','POST',event('queued-before-snooze',{frames:[{file:'https://app.example.com/queued.js',line:1,column:0,function:'queued'}]}),auth);
  const expiry=Date.now()+60000,z=await app.json(base+'/snoozes','POST',{scope:'rule',target:mailRule.id,until:expiry});
  await app.json(base+'/snoozes','POST',{scope:'issue',target:created.issue,until:expiry});
  for(let n=0;n<3;n++)await app.json('/api/ingest/web','POST',event('snooze-'+n,{frames:[{file:`https://app.example.com/burst-${n}.js`,line:1,column:0,function:'burst'}]}),auth);
  assert.equal((await app.json(base+'/controls')).snoozes.find(r=>r.id===z.id).suppressed,4);assert.equal((await app.json(base+'/deliveries')).filter(r=>r.state==='snoozed').length,4);
  const settings={timezone:'America/New_York',destination:d.id,daily:true,weekly:true,personal_daily:true,personal_weekly:false,hour:9,quiet_start:22,quiet_end:7};
  assert.equal((await app.request(base+'/digest-settings','PUT',{...settings,timezone:'invalid/timezone'})).status,400);
  await app.json(base+'/digest-settings','PUT',settings);
  const invalid=await app.request('/api/ingest/web','POST',{version:1,eventId:'loss-during-snooze'},auth);assert.ok(invalid.status>=400);
  const outcomes=await app.json('/api/projects/web/outcomes');assert.ok(outcomes.rows.some(r=>r.reason!=='accepted'&&r.count>0));
  await Promise.all([app.schedule(expiry+1),app.schedule(expiry+1)]);await app.schedule(expiry+60000);
  await app.close();app=await alertRuntime(inbox,{state,mail:'sendgrid',extraBindings:{SENDGRID_EVENT_PUBLIC_KEY:signer.key,ALERT_EVENT_PROVENANCE:'fixture'}});await app.schedule(expiry+60001);
  let controls=await app.json(base+'/controls');assert.equal(controls.digests.filter(m=>m.kind==='resumption'&&m.period===z.id).length,1);assert.equal(controls.snoozes.find(s=>s.id===z.id).suppressed,4);assert.ok(controls.held.every(x=>!x.released_at));
  const attention=await app.json('/api/projects/web/follow-up');assert.ok(attention.rows.some(a=>a.reason==='snooze_expired_backlog'));
  const resumed=await app.json('/api/ingest/web','POST',event('after-snooze-expiry',{frames:[{file:'https://app.example.com/resumed.js',line:1,column:0,function:'resumed'}]}),auth);
  assert.ok((await app.json(base+'/deliveries')).some(d=>d.issue===resumed.issue&&d.channel==='mail'&&d.state==='accepted'),'an expired snooze never suppresses later work again');assert.equal((await app.json(base+'/controls')).held.filter(h=>!h.released_at).length,4);

  const nextMorning=Date.parse(new Date(Date.now()+86400000).toISOString().slice(0,10)+'T14:00:00Z'),digestReceipts=await app.json('/api/projects/web/outcomes');await app.schedule(nextMorning);
  const dayDigest=(await app.json(base+'/controls')).digests.find(d=>d.kind==='daily'&&d.scope==='project');assert.ok(dayDigest);for(const receipt of digestReceipts.rows)assert.ok(dayDigest.body.includes(`${receipt.reason}: ${receipt.count}`),'digest preserves capture receipts during snooze');
  assert.ok((await app.json('/api/projects/web/follow-up')).rows.some(r=>r.reason.startsWith('capture_loss_')&&r.capture_loss>0));
  // New York falls back on 1 November: this completed daily period has 25 hours.
  const dst=Date.parse('2026-11-02T14:00:00Z');await Promise.all([app.schedule(dst),app.schedule(dst+1000)]);await app.schedule(dst+3600000);
  controls=await app.json(base+'/controls');const daily=controls.digests.filter(m=>m.kind==='daily'&&m.scope==='project'&&m.period==='2026-11-01..2026-11-02');assert.equal(daily.length,1);assert.equal(daily[0].state,'accepted');assert.match(daily[0].body,/America\/New_York/);assert.match(daily[0].body,/2026-11-01T04:00:00.000Z to 2026-11-02T05:00:00.000Z/);assert.match(daily[0].body,/Held alert backlog: 4/);assert.ok(!daily[0].body.includes('HIDDEN_ALERT_CANARY'));
  const weekly=controls.digests.filter(m=>m.kind==='weekly'&&m.period==='2026-10-26..2026-11-02');assert.equal(weekly.length,1);
  const history=(await app.json(base+'/deliveries')).find(r=>r.rule_id===webhook.id);assert.match(history.code,/http_204_signature_sent/);
  const otherBase='/api/projects/other/alerting',hour=new Date().getUTCHours();
  const otherSettings={timezone:'UTC',destination:null,daily:false,weekly:false,personal_daily:true,personal_weekly:false,hour:9,quiet_start:hour,quiet_end:(hour+1)%24};await app.json(otherBase+'/digest-settings','PUT',otherSettings);
  await app.json(otherBase+'/rules','POST',rule('mail',{destination:'other-v1'}));const otherKey=await app.json('/api/projects/other/keys','POST',{kind:'ingest'});await app.json('/api/projects/other/releases','POST',{name:'r1',build:'b1'});
  await app.json('/api/ingest/other','POST',event('quiet-hours'),{Authorization:'Bearer '+otherKey.key});assert.equal((await app.json(otherBase+'/controls')).held.filter(h=>!h.released_at).length,1);assert.equal((await app.request(otherBase+'/held/release','POST',{})).status,400);
  await app.request('/api/ingest/other','POST',{version:1,eventId:'quiet-loss'},{Authorization:'Bearer '+otherKey.key});await app.schedule(nextMorning);
  const otherDigest=(await app.json(otherBase+'/controls')).digests.find(d=>d.kind==='daily');assert.ok(otherDigest.body.includes('Held alert backlog: 1'));assert.ok((await app.json('/api/projects/other/follow-up')).rows.some(a=>a.reason.startsWith('capture_loss_')));
  // Current event/settings/snooze stores round-trip as inert investigation data.
  const archived=await (await app.request('/api/archive')).text();
  const preview=await app.json('/api/projects/web/erasure');let erased=await app.json('/api/projects/web/erasure','POST',{confirm:'web',planHash:preview.planHash});
  for(let n=0;n<30&&erased.phase!=='complete';n++)erased=await app.json('/api/erasures/'+erased.id+'/resume','POST',{});
  assert.equal(erased.phase,'complete');for(const table of ['alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail','alert_destination_tests'])assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM '+table+" WHERE project='web'").first()).n,0,table+' erased');
  for(const table of ['rer_mail_event_receipts','rer_mail_event_states'])assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM '+table+" WHERE event_namespace='web'").first()).n,0,table+' erased');
  await app.close();app=await alertRuntime(inbox,{mail:'sendgrid'});
  const sends=inbox.mailCount;
  const restored=await app.request('/api/restore','POST',archived,{'X-Confirm-Restore':'yes'});assert.equal(restored.status,200,await restored.text());
  await app.schedule(dst+86400000);assert.equal(inbox.mailCount,sends);controls=await app.json(base+'/controls');assert.equal(controls.settings.daily,0);assert.ok(controls.snoozes.every(z=>z.historical===1));assert.ok(controls.digests.every(d=>d.historical===1));
  console.log('ALERT-003 destination tests, delivery states, timezone digests and snoozing never hide loss: passing reviewed tests and unchanged archive projection; accepted/delivered/bounced/complained (signed fixtures), unsigned/forged/unknown refused, duplicate once; webhook HTTP/signature receipt; America/New_York daily/weekly at DST boundary once; burst held, expiry one durable resumption and suppressed count; inert restore.');
 }finally{await app?.close();await rm(state,{recursive:true,force:true})}
}
