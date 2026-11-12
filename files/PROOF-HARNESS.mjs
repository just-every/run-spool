import {mock} from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {alertRuntime,setup,rule,event} from '../tests/alerts/runtime.mjs';
import {receiver} from '../tests/alerts/receiver.mjs';
import {deliveryClock} from '../tests/alerts/delivery-flow.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
const packet='/home/agent/rer-consolidation/work/main-spool-plain-delivery-labels-1-r1/packet';
const temp=await mkdtemp(join(tmpdir(),'spool-labels-'));let app,browser;const inbox=await receiver(join(temp,'receiver.sqlite'));
try{
 mock.timers.enable({apis:['Date'],now:deliveryClock});app=await alertRuntime(inbox,{now:deliveryClock});const auth=await setup(app);
 const project=await app.json('/api/projects','POST',{id:'release-sdk',name:'SDK release labels'});
 const program="import * as Sentry from '@sentry/node';Sentry.init({dsn:process.env.SPOOL_DSN});Sentry.captureException(new Error('SDK release labels'));if(!await Sentry.flush(10000))throw new Error('SDK did not flush');await Sentry.close();";
 for(const release of [undefined,'synthetic-spool-1'])await promisify(execFile)(process.execPath,['--input-type=module','-e',program],{env:{PATH:process.env.PATH,HOME:process.env.HOME,SPOOL_DSN:project.dsn,...release?{SENTRY_RELEASE:release}:{}},timeout:20000});
 await app.json('/api/projects/web/alerting/rules','POST',rule('mail'));
 await app.json('/api/ingest/web','POST',event('labels-alert'),auth);await app.schedule(deliveryClock);
 const expiry=deliveryClock+120000;
 await app.json('/api/projects/web/alerting/digest-settings','PUT',{timezone:'America/New_York',destination:'mail-v1',daily:true,weekly:false,personal_daily:true,personal_weekly:false,hour:9,quiet_start:null,quiet_end:null});
 await app.json('/api/projects/web/alerting/snoozes','POST',{scope:'project',target:'web',until:expiry});
 await app.schedule(expiry+1000);await app.schedule(expiry+2000);await app.schedule(Date.parse('2026-11-02T14:00:00Z'));
 browser=await launchBrowser();const ctx=await browser.newContext({viewport:{width:1440,height:900}});await ctx.addCookies([{name:app.cookie.split('=')[0],value:app.cookie.split('=')[1],url:app.origin}]);const page=await ctx.newPage();
 const observations={};await page.goto(app.origin+'/projects/release-sdk/issues');await page.locator('.issue-open').first().waitFor();observations.releaseOptions=await page.getByRole('combobox',{name:'Release',exact:true}).locator('option').allTextContents();for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.getByRole('combobox',{name:'Release',exact:true}).selectOption('');await page.getByRole('status').filter({hasText:'matching your filters'}).waitFor();await page.locator('.issue-filters').screenshot({path:packet+`/no-release-filter-${width}.png`});}await page.setViewportSize({width:1440,height:900});
 const issue=(await app.json('/api/projects/release-sdk/issues'))[0];await page.goto(app.origin+'/projects/release-sdk/issues/'+issue.id);await page.getByRole('heading',{name:'Recent occurrence',exact:true}).waitFor();observations.recent=await page.locator('.recent-occurrence').innerText();observations.observed=await page.locator('section').filter({has:page.getByRole('heading',{name:'Observed deployments',exact:true})}).innerText();
 await page.goto(app.origin+'/projects/release-sdk/releases');await page.locator('.data-row').first().waitFor();observations.history=await page.getByRole('table').allTextContents();
 await page.goto(app.origin+'/projects/web/alerts');await page.getByRole('button',{name:'Delivery log',exact:true}).click();await page.getByText('suppressed locally',{exact:true}).first().waitFor();observations.delivery=await page.locator('.alert-records').allTextContents();for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.locator('.alert-records').first().screenshot({path:packet+`/local-delivery-${width}.png`});}
 await page.getByRole('button',{name:'Digests and snoozes',exact:true}).click();await page.getByRole('heading',{name:'Digest and resumption history'}).waitFor();observations.controls=await page.locator('.alert-records').allTextContents();for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.locator('.alert-records').first().screenshot({path:packet+`/local-history-${width}.png`});}
 await writeFile(packet+'/AFTER.json',JSON.stringify(observations,null,2)+'\n');console.log(JSON.stringify(observations));await ctx.close();
}finally{mock.timers.reset();await browser?.close();await app?.close();await inbox.close();await rm(temp,{recursive:true,force:true});}
