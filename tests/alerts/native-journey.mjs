import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {legacyMailRows} from '../legacy-mail.mjs';
import {event,rule,testAndReview} from './runtime.mjs';
const alerts='/api/projects/web/alerting';

export async function prepareNativeAlerts(app,kinds) {
 const project=await app.json('/api/projects','POST',{id:'web',name:'Production proof'});
 await app.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});
 await testAndReview(app.json,alerts,'mail-v1');
 const created=await app.json(alerts+'/rules','POST',rule('mail',{kinds,threshold:10}));
 return {rule:created.id,headers:{Authorization:`Bearer ${project.ingestKey}`}};
}
export async function tick(app) {
 const response=await app.tick();assert.equal(response.status,200,'native scheduled handler succeeds');
 assert.equal((await response.json()).outcome,'ok');
}
export async function capture(app,fixture,id,extra={}) {
 return app.json('/api/ingest/web','POST',event(id,{message:'Production proof error',...extra}),fixture.headers);
}
export async function verifyDelivery(app,kind) {
 const feed=await app.json('/api/projects/web/alerts');
 const alert=feed.find(row=>row.kind===kind);assert.ok(alert,`${kind} feed entry`);
 // A new issue's or regression's delivery may still be finishing in the dispatch after ingest; it settles without a further tick.
 let delivery;for(let i=0;i<100;i++){delivery=(await app.json(alerts+'/deliveries')).find(row=>row.alert_id===alert.id);if(delivery&&!['pending','queued','sending'].includes(delivery.state))break;await delay(50)}
 assert.ok(delivery,`${kind} persisted delivery`);
 assert.equal(delivery.state,'accepted');assert.equal(delivery.attempts,1);
 const detail=await app.json(alerts+'/deliveries/'+delivery.id);
 assert.equal(detail.attempts.length,1);assert.equal(detail.attempts[0].state,'accepted');
 assert.ok(detail.attempts[0].finished>=detail.attempts[0].started);
 const messages=await app.db.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').first();assert.equal(messages.n,0,'local mail is silently suppressed');
 const payload=JSON.parse(alert.payload);return {kind,alert:alert.id,issue:payload.issueId,delivery:delivery.id,state:delivery.state,attempt:detail.attempts[0],...(payload.window?{window:payload.window}:{})};
}
export async function newIssue(app,fixture) {
 await capture(app,fixture,'native-new');await tick(app);
 return verifyDelivery(app,'new_issue');
}
export async function regression(app,fixture) {
 const issue=(await app.json('/api/projects/web/issues'))[0];
 await app.json('/api/projects/web/issues/'+issue.id,'PATCH',{state:'resolved',revision:issue.revision});
 await app.json('/api/projects/web/releases','POST',{name:'r2',build:'b2'});
 await capture(app,fixture,'native-regression',{release:'r2',build:'b2'});await tick(app);
 return verifyDelivery(app,'regression');
}
async function waitUntil(time) {
 while(Date.now()<time)await delay(Math.min(time-Date.now(),1000));
}
export async function spike(app,fixture,record=()=>{}) {
 const cursor=await app.db.prepare('SELECT next_start FROM alert_cursors WHERE rule_id=?').bind(fixture.rule).first();
 const start=Math.max(cursor.next_start,Math.ceil(Date.now()/60000)*60000),end=start+60000;
 record({waitingForWindow:{start,end}});
 await waitUntil(start+100);
 for(let i=0;i<10;i++)await capture(app,fixture,'native-spike-'+i,{release:'r2',build:'b2'});
 assert.ok(Date.now()<end,'all native ingestion fits the measured minute');
 await tick(app);assert.equal((await app.json('/api/projects/web/alerts')).filter(row=>row.kind==='spike').length,0,'open window is not evaluated');
 await waitUntil(end+100);await tick(app);
 const receipt=await verifyDelivery(app,'spike');
 assert.equal(receipt.window.count,10);assert.equal(receipt.window.start,new Date(start).toISOString());assert.equal(receipt.window.end,new Date(end).toISOString());
 const after=await app.db.prepare('SELECT next_start FROM alert_cursors WHERE rule_id=?').bind(fixture.rule).first();
 assert.equal(after.next_start,end,'completed-window cursor progresses');
 return {...receipt,cursorBefore:cursor.next_start,cursorAfter:after.next_start};
}
export async function verifyNoReplay(app) {
 const before=await app.json(alerts+'/deliveries');
 const outboxBefore=await legacyMailRows(app.origin);
 await tick(app);
 assert.deepEqual((await app.json(alerts+'/deliveries')).map(({id,state,attempts})=>({id,state,attempts})),before.map(({id,state,attempts})=>({id,state,attempts})));
 assert.deepEqual(await legacyMailRows(app.origin),outboxBefore,'subsequent tick creates no outbox message');
 return {deliveries:before.length,attempts:before.map(row=>row.attempts),replayed:false};
}
