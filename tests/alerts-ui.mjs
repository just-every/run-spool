import {queuedEntrypoint} from '@runeditrun/rer/queued-entry';
const queuedExit=await queuedEntrypoint(import.meta.url);if(queuedExit!==null)process.exit(queuedExit);
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {receiver} from './alerts/receiver.mjs';
import {alertRuntime,event,rule,setup} from './alerts/runtime.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {workbenchLink} from './navigation.mjs';
const temp=await mkdtemp(resolve(tmpdir(),'spool-alert-ui-')),inbox=await receiver(resolve(temp,'receiver.sqlite'));let app,browser;
try {
 app=await alertRuntime(inbox);const auth=await setup(app);
 await app.json('/api/projects/web/alerting/rules','POST',rule('webhook'));
 browser=await launchBrowser();const errors=[];
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies([{name:app.cookie.split('=')[0],value:app.cookie.split('=')[1],url:app.origin}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(app.origin);await (await workbenchLink(page,'Alerts')).click();await page.getByRole('button',{name:'Rules',exact:true}).click();
  await page.getByLabel('Destination name',{exact:true}).fill(`On call ${width}`);await page.getByLabel('Destination email',{exact:true}).fill(`oncall-${width}@example.com`);await page.getByRole('button',{name:'Add destination',exact:true}).click();
  await page.getByRole('button',{name:`Test On call ${width}`,exact:true}).click();await page.getByRole('status').filter({hasText:'Local development suppresses mail'}).waitFor();
  await page.getByRole('button',{name:`Edit On call ${width}`,exact:true}).click();await page.getByLabel('Destination email',{exact:true}).fill(`updated-${width}@example.com`);await page.getByRole('button',{name:'Save destination',exact:true}).click();await page.getByText(`Email · updated-${width}@example.com`,{exact:true}).waitFor();
  await page.getByLabel('Rule name',{exact:true}).fill(`Browser mail ${width}`);await page.getByRole('button',{name:'Alert feed',exact:true}).click();await page.getByRole('button',{name:'Rules',exact:true}).click();assert.equal(await page.getByLabel('Rule name',{exact:true}).inputValue(),`Browser mail ${width}`);await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption({label:`On call ${width} · Email`});await page.getByRole('button',{name:'Create rule',exact:true}).click();await page.getByRole('button',{name:`Edit Browser mail ${width}`,exact:true}).waitFor();
  await page.reload();await (await workbenchLink(page,'Alerts')).click();await page.getByRole('button',{name:'Rules',exact:true}).click();await page.getByRole('button',{name:`Edit Browser mail ${width}`,exact:true}).click();await page.getByLabel('Rule name',{exact:true}).fill(`Updated mail ${width}`);await page.getByRole('button',{name:'Save rule',exact:true}).click();await page.getByRole('button',{name:`Edit Updated mail ${width}`,exact:true}).waitFor();
  const before=(await app.json('/api/projects/web/alerting/rules')).find(r=>r.name===`Updated mail ${width}`);
  await page.getByRole('button',{name:`Edit On call ${width}`,exact:true}).click();await page.getByLabel('Destination email',{exact:true}).fill(`rotated-${width}@example.com`);await page.getByRole('button',{name:'Save destination',exact:true}).click();await page.getByText(`Email · rotated-${width}@example.com`,{exact:true}).waitFor();
  const after=(await app.json('/api/projects/web/alerting/rules')).find(r=>r.id===before.id);assert.equal(after.revision,before.revision+1);assert.notEqual(after.destination,before.destination);
  const archive=await (await app.request('/api/archive')).text();assert.ok(!archive.includes(`rotated-${width}@example.com`));
  await app.json('/api/ingest/web','POST',event(`browser-${width}`,{frames:[{file:`https://app.example.com/ui-${width}.js`,line:1,column:0,function:'browser'}]}),auth);await app.schedule(Date.now());
  await page.getByRole('button',{name:'Refresh alerts',exact:true}).click();await page.getByRole('button',{name:'Delivery log',exact:true}).click();await page.getByText('accepted',{exact:true}).nth(1).waitFor();// Keep the exact opener: a pending alerts refresh can prepend newer deliveries.
  const deliveryDetails=await page.getByRole('button',{name:/Details: Delivery/}).first().elementHandle();assert.ok(deliveryDetails);await deliveryDetails.click();await page.getByRole('dialog').getByRole('heading',{name:'Saved delivery facts'}).waitFor();await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement),null,{timeout:5000}).catch(()=>{});assert.ok(await page.getByRole('dialog').evaluate(dialog=>dialog.contains(document.activeElement)));// close() queues the native close event; wait for that event and React's onClose handler.
  const dismissal=await page.getByRole('dialog').evaluateHandle(dialog=>{const state={closed:false};dialog.addEventListener('close',()=>{state.closed=true;},{once:true});return state;});
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(({closed})=>closed,dismissal,{timeout:5000});await dismissal.dispose();
  assert.ok(await deliveryDetails.evaluate(button=>document.activeElement===button));await deliveryDetails.dispose();
  inbox.statuses.push(429);await app.json('/api/ingest/web','POST',event(`retry-${width}`,{frames:[{file:`https://app.example.com/retry-${width}.js`,line:1,column:0,function:'retry'}]}),auth);await app.schedule(Date.now());await page.getByRole('button',{name:'Refresh alerts',exact:true}).click();await page.getByText('retrying',{exact:true}).first().waitFor();
  inbox.statuses.push(503);await app.json('/api/ingest/web','POST',event(`uncertain-${width}`,{frames:[{file:`https://app.example.com/uncertain-${width}.js`,line:1,column:0,function:'uncertain'}]}),auth);await app.schedule(Date.now()+2000);await page.getByRole('button',{name:'Refresh alerts',exact:true}).click();await page.getByText('uncertain',{exact:true}).first().waitFor();
  await app.json('/api/ingest/web','POST',event(`blocked-${width}`,{frames:[{file:`https://app.example.com/blocked-${width}.js`,line:1,column:0,function:'blocked'}]}),{...auth,'x-fixture-unconfigured':'egress'});await app.json('/__fixture/schedule','POST',{time:Date.now(),disableEgress:true});await page.getByRole('button',{name:'Refresh alerts',exact:true}).click();await page.getByText('blocked',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Alert feed',exact:true}).click();await page.getByRole('button',{name:'Open issue',exact:true}).first().waitFor();
  await page.getByRole('combobox',{name:'Project',exact:true}).selectOption('other');await page.getByRole('button',{name:'Delivery log',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Details: Delivery/}).count(),0);await page.getByRole('combobox',{name:'Project',exact:true}).selectOption('web');
  await page.getByRole('button',{name:'Rules',exact:true}).click();await page.getByRole('button',{name:`Edit Updated mail ${width}`,exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.getByRole('button',{name:'Alert feed',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Open issue',exact:true}).first().waitFor();
  const html=await page.content();assert.ok(!html.includes('alert-owner@example.com'));assert.ok(!html.includes(app.bindings.ALERT_DESTINATION_HASH_KEY));
  await mkdir('.artifacts/alerts',{recursive:true});await page.screenshot({path:`.artifacts/alerts/journey-${width}.png`,fullPage:true});await context.close();
 }
 assert.deepEqual(errors,[]);console.log('Alert browser journeys passed at 1440 and 390: persisted rule create/edit/reload, real feed/delivery/webhook state, project isolation and keyboard navigation.');
}finally{await browser?.close();await app?.close();await inbox.close();await rm(temp,{recursive:true,force:true});}
