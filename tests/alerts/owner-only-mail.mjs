import assert from 'node:assert/strict';
import {alertRuntime,event,rule,testAndReview} from './runtime.mjs';
import {testOwner} from '../auth.mjs';

// MAIL_RECIPIENTS=owner: real Worker, D1 and SendGrid adapter; only the provider's network edge is the fixture receiver,
// which records every recipient that would have left the Worker.
export async function ownerOnlyMail(inbox) {
 const base='/api/projects/web/alerting',other=['other-owner','example.com'].join('@');
 const app=await alertRuntime(inbox,{mail:'sendgrid',configure:false,extraBindings:{MAIL_RECIPIENTS:'owner'}});
 try {
  const project=await app.json('/api/projects','POST',{id:'web',name:'Web app'});await app.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});
  const mine=await app.json(base+'/destinations','POST',{label:'Owner mailbox',recipient:testOwner});
  const theirs=await app.json(base+'/destinations','POST',{label:'Someone else',recipient:other});
  inbox.sendgridRecipients.length=0;
  await testAndReview(app.json,base,mine.id);
  assert.deepEqual(inbox.sendgridRecipients,[[testOwner]],'one test alert reached the owner address only');
  const refused=await app.json(base+'/destinations/'+theirs.id+'/test','POST',{});
  assert.equal(refused.state,'failing','a test to another address fails');
  assert.equal(inbox.sendgridRecipients.length,1,'the other address never reached the provider');
  assert.equal((await app.request(base+'/rules','POST',rule('mail',{destination:theirs.id}))).status,400,'a rule cannot use an address that never passed a test');
  await app.json(base+'/rules','POST',rule('mail',{destination:mine.id}));
  await app.json('/api/ingest/web','POST',event('owner-only'),{Authorization:`Bearer ${project.ingestKey}`});
  await app.schedule(Date.now());
  const delivery=(await app.json(base+'/deliveries')).find(row=>row.channel==='mail');
  assert.equal(delivery?.state,'accepted');
  assert.ok(inbox.sendgridRecipients.every(to=>to.length===1&&to[0]===testOwner),'every message that left the Worker was addressed to the owner alone: '+JSON.stringify(inbox.sendgridRecipients));
  // With no mail provider set the same owner destination sends nothing.
  const sent=inbox.sendgridRecipients.length;
  await app.db.prepare('DELETE FROM alert_destination_tests').run();
  const off=await app.request(base+'/destinations/'+mine.id+'/test','POST',{},{'x-fixture-unconfigured':'mail'});
  assert.ok(!off.ok||(await off.json()).state==='failing','mail off: the test does not pass');
  assert.equal(inbox.sendgridRecipients.length,sent,'mail off: nothing reached the provider');
 } finally {await app.close()}
}
