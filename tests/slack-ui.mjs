// [ALERT-002] Reuses the alert journey's browser; real UI, recorded egress edge.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {alertRuntime,event} from './alerts/runtime.mjs';
import {slackReceiver} from './slack-flow.mjs';
import {workbenchLink} from './navigation.mjs';
export async function slackUI(browser,inbox){
 await mkdir('.artifacts/c15/alert002',{recursive:true});
 for(const width of [1440,390]){
  const edge=slackReceiver(),app=await alertRuntime(inbox,{configure:false,egressBridge:wire=>edge.send(wire)}),context=await browser.newContext({viewport:{width,height:1000}});
  try{
   const p=await app.json('/api/projects','POST',{id:'web',name:'Checkout service'});await app.json('/api/projects/web/releases','POST',{name:'r1',build:'b1'});
   await context.addCookies([{name:app.cookie.split('=')[0],value:app.cookie.split('=')[1],url:app.origin}]);const page=await context.newPage();await page.goto(app.origin);await (await workbenchLink(page,'Settings')).click();
   await page.getByLabel('Slack destination name',{exact:true}).fill('Checkout on call');await page.getByLabel('Slack channel identifier',{exact:true}).fill('synthetic-spool-checkout');await page.getByLabel('Slack bot token',{exact:true}).fill('synthetic-spool-'+crypto.randomUUID());await page.getByRole('button',{name:'Connect Slack',exact:true}).click();await page.getByRole('button',{name:'Test Checkout on call',exact:true}).click();await page.getByRole('button',{name:'Review passing test for Checkout on call',exact:true}).click();await page.getByText('Passing result reviewed',{exact:true}).waitFor();assert.equal(await page.getByLabel('Slack bot token',{exact:true}).inputValue(),'');
   const inspect=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact)),[]);assert.deepEqual(await page.locator('button').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&!n.textContent.trim()).map(n=>n.getAttribute('aria-label'))),[],'no icon-only control on touched screen');await (name==='settings'?page.getByRole('region',{name:'Slack destinations',exact:true}):page).screenshot({path:`.artifacts/c15/alert002/${name}-${width}.png`,...(name==='settings'?{}:{fullPage:true})})};
   await inspect('settings');await (await workbenchLink(page,'Alerts')).click();await page.getByRole('button',{name:'Rules',exact:true}).click();await page.getByLabel('Rule name',{exact:true}).fill('Checkout Slack alerts');await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption({label:'Checkout on call · Slack'});await page.getByRole('button',{name:'Preview rule',exact:true}).click();await page.getByRole('region',{name:'Rule preview',exact:true}).waitFor();await page.getByRole('button',{name:'Create rule',exact:true}).click();await page.getByRole('button',{name:'Edit Checkout Slack alerts',exact:true}).waitFor();
   await app.json('/api/ingest/web','POST',event('synthetic-spool-ui-'+width,{message:'Payment confirmation missing',frames:[{file:'checkout.js',line:23,column:0,function:'confirm'}]}),{Authorization:`Bearer ${p.ingestKey}`});await app.schedule(Date.now());await page.getByRole('button',{name:'Refresh alerts',exact:true}).click();await page.getByRole('button',{name:'Delivery log',exact:true}).click();await page.getByText('posted',{exact:true}).first().waitFor();await inspect('deliveries');
   await (await workbenchLink(page,'Settings')).click();await page.getByRole('button',{name:'Rotate Checkout on call',exact:true}).click();await page.getByLabel('Slack bot token',{exact:true}).fill('synthetic-spool-'+crypto.randomUUID());await page.getByRole('button',{name:'Rotate Slack token',exact:true}).click();await page.getByRole('status').filter({hasText:'Slack token rotated.'}).waitFor();assert.equal((await app.json('/api/projects/web/alerting/rules'))[0].enabled,0);await page.getByRole('button',{name:'Revoke Checkout on call',exact:true}).click();await page.getByRole('status').filter({hasText:'Slack destination revoked.'}).waitFor();
  }finally{await context.close();await app.close()}
 }
 console.log('[ALERT-002] Slack settings/test/review/rotate/revoke and posted delivery identifiers at 1440/390: no overflow, serious Axe finding or icon-only control');
}
