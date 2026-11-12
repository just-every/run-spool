import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {startTestWorker} from '../tests/worker.mjs';
import {signIn} from '../tests/auth.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
import {workbenchLink} from '../tests/navigation.mjs';
const directory='/home/agent/rer-consolidation/work/main-spool-settings-split-1/packet';
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],screens:[]};
const worker=await startTestWorker(15580);let browser;
try {
const cookie=await signIn(worker.origin);
const api=async(path,method='GET',body)=>{const r=await fetch(worker.origin+path,{method,headers:{Cookie:cookie,Origin:worker.origin,...body?{'Content-Type':'application/json'}:{}},...body?{body:JSON.stringify(body)}:{}});assert.ok(r.ok,path);return r.json();};
await api('/api/projects','POST',{id:'synthetic-spool-1',name:'Synthetic Spool'});
browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:worker.origin}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(worker.origin+'/projects/synthetic-spool-1/issues');await (await workbenchLink(page,'Settings')).click();
const nav=page.getByRole('navigation',{name:'Settings sections'});await expect(nav).toBeVisible();
await nav.getByRole('link',{name:'Projects & keys',exact:true}).click();await expect(page.getByRole('heading',{name:'Project keys',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Members',exact:true})).toBeHidden();
const mint=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/projects/synthetic-spool-1/keys'&&r.request().method()==='POST');await page.getByRole('button',{name:'Create deploy key',exact:true}).click();assert.equal((await mint).status(),201);await page.getByRole('button',{name:'Dismiss key',exact:true}).click();
const keyRows=await api('/api/projects/synthetic-spool-1/keys');const deploy=keyRows.find(row=>row.kind==='deploy');assert.ok(deploy);await page.locator(`[data-key-hash="${deploy.hash}"]`).getByRole('button',{name:'Details: Project key',exact:true}).click();await page.getByRole('dialog',{name:'Project key',exact:true}).getByRole('button',{name:'Revoke key',exact:true}).click();await expect(page.getByRole('dialog',{name:'Project key',exact:true})).toContainText('Revoked');await page.getByRole('button',{name:'Close details',exact:true}).click();assert.ok((await api('/api/projects/synthetic-spool-1/keys')).find(row=>row.hash===deploy.hash).revoked);
await page.getByLabel('Project name',{exact:true}).fill('Unsubmitted draft');
await nav.getByRole('link',{name:'Data & archive',exact:true}).click();await expect(page.getByRole('heading',{name:'Archive and restore',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Project keys',exact:true})).toBeHidden();
const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download private archive',exact:true}).click();assert.equal(await (await downloaded).failure(),null);assert.ok(await page.getByRole('button',{name:'Restore into empty installation',exact:true}).isDisabled());
await page.goBack();await expect(page.getByRole('heading',{name:'Project keys',exact:true})).toBeVisible();await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('Unsubmitted draft');await page.goForward();await expect(page.getByRole('heading',{name:'Archive and restore',exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Archive and restore',exact:true})).toBeVisible();
receipt.checks.push('1440: public Settings navigation, isolated sections, create/revoke deploy key, private archive download, nonempty restore refusal, retained draft, refresh, Back/Forward');
for(const [fragment,heading] of [['slack-destinations','Slack destinations'],['reports-configuration-title','Reports, dashboards and query tables'],['grouping-rules-heading','Project grouping rules'],['audit-history-heading','Organization audit']]){await page.goto(worker.origin+'/projects/synthetic-spool-1/settings#'+fragment);await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();}
receipt.checks.push('1440: old Slack, report, grouping and audit fragments reveal their containing section');
for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});await page.goto(worker.origin+'/projects/synthetic-spool-1/settings');await nav.waitFor();await page.waitForLoadState('networkidle');
 for(const link of await nav.getByRole('link').all()){
  const label=await link.innerText();await link.click();await page.waitForLoadState('networkidle');await page.evaluate(()=>scrollTo(0,0));
  if(width===1440){const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id),[]);assert.equal(await page.evaluate(()=>document.querySelectorAll('.settings-section:not([hidden])').length),1);}
  const facts=await page.evaluate(()=>({height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,visibleHeadings:[...document.querySelectorAll('.settings-section:not([hidden]) h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent)}));
  assert.equal(facts.overflow,false);
  const file=`after-${width}-${(await link.getAttribute('href')).slice(1)}.png`;await page.screenshot({path:directory+'/'+file,fullPage:true,mask:[page.locator('.secret-key,[data-secret],input[type="password"]')]});receipt.screens.push({width,section:label,file,...facts});
 }
}
assert.deepEqual(errors,[]);receipt.status='passed';console.log('Settings public proof passed');
} catch(error){receipt.status='failed';receipt.error=error.message;throw error;} finally{await browser?.close();await worker.stop();await writeFile(directory+'/browser-receipt.json',JSON.stringify(receipt,null,2)+'\n');}
