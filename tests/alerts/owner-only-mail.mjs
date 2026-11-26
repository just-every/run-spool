import assert from 'node:assert/strict';
import {alertRuntime,event,rule,testAndReview} from './runtime.mjs';
import {testOwner} from '../auth.mjs';
import {legacyMailRows} from '../legacy-mail.mjs';

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
  await ownerSignInMail(app,inbox);
 } finally {await app.close()}
}

// The owner's way in through the public sign-in door: the owner's address gets a single-use link that signs in; a member's,
// an inactive operator's or a stranger's address gets no mail and the owner's answer, so the door reveals no account.
async function ownerSignInMail(app,inbox) {
 const member=['member','spool.test'].join('@'),inactive=['former','spool.test'].join('@'),stranger=['stranger','example.com'].join('@');
 for(const [id,email,status] of [['member-1',member,'active'],['member-2',inactive,'inactive']])
  await app.db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES(?,?,'Member','member',?,1,?)").bind(id,email,status,Date.now()).run();
 let ip=60;
 const ask=async(email,form)=>{const response=await app.request('/auth/magic-link','POST',form?new URLSearchParams({email,returnTo:'/'}).toString():{email,returnTo:'/'},{Cookie:'','CF-Connecting-IP':'192.0.2.'+ip++,...(form?{'content-type':'application/x-www-form-urlencoded',accept:'text/html'}:{})});
  return {status:response.status,location:response.headers.get('location'),body:await response.text()}};
 const before=inbox.sendgridRecipients.length;
 const owner=await ask(testOwner,true);
 assert.deepEqual(inbox.sendgridRecipients.slice(before),[[testOwner]],'the owner sign-in link went to the owner alone');
 const token=(await legacyMailRows(app.origin))[0].message.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];assert.ok(token);
 const confirm=()=>app.request('/auth/confirm','POST',{token},{Cookie:''});
 const confirmed=await confirm();assert.equal(confirmed.status,303);
 const session=confirmed.headers.get('set-cookie').split(';')[0];
 assert.equal((await app.request('/api/projects','GET',undefined,{Cookie:session})).status,200,'the mailed link signs the owner in');
 assert.equal((await confirm()).status,400,'the link is single-use');
 const ownerJson=await ask(testOwner,false);
 for(const email of [member,inactive,stranger]) {
  assert.deepEqual(await ask(email,true),owner,'the form answers '+email+' exactly as it answers the owner');
  assert.deepEqual(await ask(email,false),ownerJson,'the JSON door answers '+email+' exactly as it answers the owner');
 }
 assert.deepEqual(inbox.sendgridRecipients.slice(before),[[testOwner],[testOwner]],'sign-in mail reached the provider for the owner alone');
 // A slow provider takes the mail and never answers within the transport limit: the send is uncertain, not refused. The
 // page gives the owner's usual answer, and the link in the late mail still signs in, once.
 inbox.mailStatuses.push('hang');
 assert.deepEqual(await ask(testOwner,true),owner,'a timed-out send answers as a sent link');
 const late=inbox.lateMail.at(-1)?.content.find(part=>part.type==='text/plain').value.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1];
 assert.ok(late&&late!==token,'the late mail carries a fresh link');
 const lateConfirm=()=>app.request('/auth/confirm','POST',{token:late},{Cookie:''});
 assert.equal((await lateConfirm()).status,303,'the late link signs in');
 assert.equal((await lateConfirm()).status,400,'the late link is single-use');
 // The owner keeps OWNER_EMAIL while only it is mailed, so moving the address can never end their email sign-in.
 const moved=await app.request('/auth/email','POST',{email:stranger},{Cookie:session});
 assert.equal(moved.status,409);assert.equal((await moved.json()).error,'owner_email_pinned');
}
