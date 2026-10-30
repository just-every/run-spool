import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {receiver} from './alerts/receiver.mjs';
import {alertRuntime,event,rule,setup,relayUrl} from './alerts/runtime.mjs';
import {testOwner} from './auth.mjs';

export async function edgeJourney() {
const temp=await mkdtemp(resolve(tmpdir(),'spool-alert-edge-')),inbox=await receiver(resolve(temp,'receiver.sqlite'));let app;
try {
 app=await alertRuntime(inbox);const auth=await setup(app);
 await app.json('/api/projects/web/alerting/rules','POST',rule('webhook'));
 await app.json('/api/ingest/web','POST',event('blocked'),{...auth,'x-fixture-unconfigured':'egress'});await app.json('/__fixture/schedule','POST',{time:Date.now(),disableEgress:true});
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
 await app.close();app=await alertRuntime(inbox,{mail:'rer'});const relayKey=await setup(app);
 const signin=inbox.relayRequests[0];assert.equal(signin.body.to,testOwner);assert.match(signin.body.text,/\/auth\/confirm\?token=/);
 const sentBeforeHint=inbox.relayRequests.length;
 for(const path of ['/signin','/sign-in']) {
  const hinted=await app.request(path+'?login_hint='+encodeURIComponent('James@Spool.example')+'&returnTo=%2Fsetup','GET',undefined,{Cookie:''});
  assert.equal(hinted.status,200);assert.match(await hinted.text(),/name="email"[^>]*value="james@spool.example"/);
 }
 for(const hint of ['not-an-email','<script>','owner@example.com" autofocus="']) {
  const page=await app.request('/signin?login_hint='+encodeURIComponent(hint),'GET',undefined,{Cookie:''});assert.match(await page.text(),/name="email"[^>]*value=""/);
 }
 assert.equal(inbox.relayRequests.length,sentBeforeHint,'a login hint never requests mail');
 await app.json('/api/projects/web/alerting/rules','POST',rule('mail'));inbox.mailStatuses.push(429);
 await app.json('/api/ingest/web','POST',event('relay-rate-limit'),relayKey);await app.schedule(Date.now());
 assert.equal((await app.json('/api/projects/web/alerting/deliveries'))[0].state,'retrying');const attempts=inbox.relayRequests.length;
 await app.schedule(Date.now()+2000);assert.equal((await app.json('/api/projects/web/alerting/deliveries'))[0].state,'accepted');assert.equal(inbox.relayRequests.length,attempts+1);
 inbox.mailStatuses.push(401);await app.json('/api/ingest/web','POST',event('relay-retired-key',{frames:[{file:'https://app.example.com/retired.js',line:1,column:0,function:'retired'}]}),relayKey);await app.schedule(Date.now());
 assert.ok((await app.json('/api/projects/web/alerting/deliveries')).some(r=>r.state==='rejected'&&r.code==='provider_rejected'));
 inbox.mailStatuses.push(401);const unavailable=await app.request('/auth/magic-link','POST',{email:testOwner},{'CF-Connecting-IP':'192.0.2.40'});assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).error,'mail_unavailable');assert.equal((await app.request('/health')).status,200);
 inbox.mailStatuses.push(401);
 const failedForm=await app.request('/auth/magic-link','POST',new URLSearchParams({email:testOwner,returnTo:'/setup'}).toString(),{'content-type':'application/x-www-form-urlencoded',accept:'text/html','CF-Connecting-IP':'192.0.2.41'});
 assert.equal(failedForm.status,503);const failedHtml=await failedForm.text();assert.match(failedHtml,/<p role="alert">[^<]+<\/p>/);assert.doesNotMatch(failedHtml,/mail_unavailable/);
 const redirects=inbox.redirectRequests.length;inbox.mailStatuses.push(302);await app.json('/api/ingest/web','POST',event('relay-redirect',{frames:[{file:'https://app.example.com/redirect.js',line:1,column:0,function:'redirect'}]}),relayKey);await app.schedule(Date.now());
 assert.ok((await app.json('/api/projects/web/alerting/deliveries')).some(r=>r.state==='rejected'&&r.code==='provider_redirected'));
 const afterRedirect=inbox.relayRequests.length;await app.schedule(Date.now()+10000);assert.equal(inbox.relayRequests.length,afterRedirect,'a refused redirect is never retried');assert.equal(inbox.redirectRequests.length,redirects,'the redirect target is never fetched');
 if(process.env.SPOOL_SHOTS) {
  const {launchBrowser}=await import('./browser-launch.mjs');const browser=await launchBrowser();
  try {
   await mkdir(process.env.SPOOL_SHOTS,{recursive:true});
   for(const width of [1440]) {
    // Each browser journey gets its own installation and ordinary auth budget.
    await app.close();app=await alertRuntime(inbox,{mail:'rer'});
    const page=await browser.newPage({viewport:{width,height:900},extraHTTPHeaders:{'CF-Connecting-IP':width===1440?'192.0.2.50':'192.0.2.51'}});
    await page.goto(app.origin+'/signin?login_hint='+encodeURIComponent('james@spool.example'));
    assert.equal(await page.getByRole('textbox',{name:'Owner email'}).inputValue(),'james@spool.example');
    await page.screenshot({path:resolve(process.env.SPOOL_SHOTS,`login-hint-${width}.png`),fullPage:true});
    await page.getByRole('textbox',{name:'Owner email'}).fill(testOwner);
    await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();await page.getByRole('status').waitFor();
    await page.screenshot({path:resolve(process.env.SPOOL_SHOTS,`signin-requested-${width}.png`),fullPage:true});
    await page.goto(app.origin+'/signin?login_hint='+encodeURIComponent(testOwner));inbox.mailStatuses.push(401);
    await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();await page.getByRole('alert').waitFor();
    assert.doesNotMatch(await page.getByRole('alert').textContent(),/mail_unavailable/);
    await page.screenshot({path:resolve(process.env.SPOOL_SHOTS,`mail-unavailable-${width}.png`),fullPage:true});
    for(const slug of ['install','capture','agents']) {
     const response=await page.goto(app.origin+'/docs/'+slug);assert.equal(response.status(),200);
     await page.screenshot({path:resolve(process.env.SPOOL_SHOTS,`docs-${slug}-${width}.png`),fullPage:true});
    }
    await page.close();
   }
  } finally {await browser.close()}
 }
 for(const request of inbox.relayRequests){assert.equal(request.url,relayUrl);assert.equal(request.method,'POST');assert.equal(request.redirect,'manual');assert.equal(request.authorization,'Bearer synthetic-key-no-provider-call');assert.equal(request.contentType,'application/json');assert.deepEqual(Object.keys(request.body).sort(),request.body.html?['html','subject','text','to']:['subject','text','to']);assert.equal(typeof request.body.to,'string');assert.ok(request.body.subject&&request.body.text);}
 console.log('Alert edge policy passed: missing enforcing egress blocks without fetch; real Base mail 429 retries, 503 uncertainty never replays, rule revocation cancels pending work.');
 console.log('RER relay: native sign-in and alert mail POST the exact relay envelope with Bearer credentials; emitted workerd uses Base redirect:manual; 302 is rejected/provider_redirected with no target fetch or retry; 429 queues then retries per policy; 401 is a rejected delivery and a plain owner-visible sign-in problem, with health intact. Login hints prefill both sign-in paths without sending mail.');
}finally{await app?.close();await inbox.close();await rm(temp,{recursive:true,force:true});}

}
