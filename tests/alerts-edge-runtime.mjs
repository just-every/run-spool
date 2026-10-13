import {queuedEntrypoint} from '../scripts/base-onboarding/queued-entry.mjs';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {receiver} from './alerts/receiver.mjs';
import {alertRuntime,event,rule,setup} from './alerts/runtime.mjs';
const temp=await mkdtemp(resolve(tmpdir(),'spool-alert-edge-')),inbox=await receiver(resolve(temp,'receiver.sqlite'));let app;
try {
 app=await alertRuntime(inbox,{egress:false});const auth=await setup(app);
 await app.json('/api/projects/web/alerting/rules','POST',rule('webhook'));
 await app.json('/api/ingest/web','POST',event('blocked'),auth);await app.schedule(Date.now());
 const blocked=await app.json('/api/projects/web/alerting/deliveries');assert.equal(blocked.length,1);assert.equal(blocked[0].state,'blocked');assert.equal(inbox.requests.length,0);
 await app.close();app=await alertRuntime(inbox,{destinationUrl:'https://127.0.0.1/private'});await setup(app);
 assert.equal((await app.json('/api/projects/web/alerting/destinations')).configuration,'blocked');assert.equal((await app.request('/api/projects/web/alerting/rules','POST',rule('webhook'))).status,400);assert.equal(inbox.requests.length,0);
 await app.close();app=await alertRuntime(inbox,{mail:'resend'});const key=await setup(app);
 const created=await app.json('/api/projects/web/alerting/rules','POST',rule('mail'));inbox.mailStatuses.push(429);
 await app.json('/api/ingest/web','POST',event('mail-rate-limit'),key);await app.schedule(Date.now());
 let logs=await app.json('/api/projects/web/alerting/deliveries');assert.equal(logs[0].state,'retrying');assert.equal(inbox.mailCount,1);
 await app.schedule(Date.now()+2000);logs=await app.json('/api/projects/web/alerting/deliveries');assert.equal(logs[0].state,'accepted');assert.equal(inbox.mailCount,2);
 inbox.mailStatuses.push(503);await app.json('/api/ingest/web','POST',event('mail-uncertain',{frames:[{file:'https://app.example.com/second.js',line:1,column:0,function:'second'}]}),key);await app.schedule(Date.now());assert.ok((await app.json('/api/projects/web/alerting/deliveries')).some(r=>r.state==='uncertain'));const count=inbox.mailCount;await app.schedule(Date.now()+10000);assert.equal(inbox.mailCount,count);
 // Disable after admission but before dispatch: pending work is cancelled without an effect.
 // The dispatch after ingest finds mail unconfigured on this request, so the intent stays undelivered for the cron.
 await app.json('/api/ingest/web','POST',event('revoked-before-send',{frames:[{file:'https://app.example.com/revoked.js',line:1,column:0,function:'revoked'}]}),{...key,'x-fixture-unconfigured':'mail'});
 await app.json('/api/projects/web/alerting/rules/'+created.id,'PUT',rule('mail',{revision:1,enabled:false}));await app.schedule(Date.now());assert.equal(inbox.mailCount,count);assert.ok((await app.json('/api/projects/web/alerting/deliveries')).some(r=>r.state==='cancelled'));
 console.log('Alert edge policy passed: missing enforcing egress blocks without fetch; real Base mail 429 retries, 503 uncertainty never replays, rule revocation cancels pending work.');
}finally{await app?.close();await inbox.close();await rm(temp,{recursive:true,force:true});}
