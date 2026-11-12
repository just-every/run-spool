import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
const packet=process.env.HOME+'/rer-consolidation/work/main-spool-settings-split-1-c1-pc1/packet';
await mkdir(packet+'/screenshots',{recursive:true});
const worker=await startTestWorker(15484);let browser;
const sections=[['organization','Organization','Members'],['projects','Projects & keys','Project keys'],['processing','Issue processing','Project grouping rules'],['alerts','Alerts & integrations','Slack destinations'],['privacy','Privacy & filtering','Privacy'],['data','Data & archive','Archive and restore'],['audit','Audit','Audit']];
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),assertionWidth:1440,captureWidths:[1440,390],sections:[],legacy:[],screenshots:[]};
try{
 const cookie=await signIn(worker.origin);
 const made=await fetch(worker.origin+'/api/projects',{method:'POST',headers:{Cookie:cookie,Origin:worker.origin,'Content-Type':'application/json'},body:JSON.stringify({id:'synthetic-spool-settings',name:'Synthetic Settings project'})});assert.equal(made.status,201);await made.body.cancel();
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:worker.origin}]);
 const page=await context.newPage();await page.goto(worker.origin+'/projects/synthetic-spool-settings/settings');
 const nav=page.getByRole('navigation',{name:'Settings sections'});await nav.waitFor();await page.waitForLoadState('networkidle');
 assert.equal(await nav.getByRole('link').count(),7);
 for(const [id,label] of sections){
  await nav.getByRole('link',{name:label,exact:true}).click();
  await page.waitForFunction(id=>!document.getElementById('settings-'+id)?.hidden,id);
  assert.equal(new URL(page.url()).hash,'#settings-'+id);
  assert.equal(await page.locator('.settings-section:visible').count(),1);
  assert.equal(await nav.getByRole('link',{name:label,exact:true}).getAttribute('aria-current'),'page');
  const address=page.url();await page.reload();await page.waitForFunction(id=>!document.getElementById('settings-'+id)?.hidden,id);assert.equal(page.url(),address);
  receipt.sections.push({id,label,address:new URL(address).pathname+new URL(address).hash,reload:true,onlySelectedSectionVisible:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);
   const path=`screenshots/settings-${id}-${width}.png`;await page.screenshot({path:packet+'/'+path,fullPage:true,mask:[page.locator('.secret-key,input[type="password"],[data-secret]')]});receipt.screenshots.push(path);
  }
  await page.setViewportSize({width:1440,height:900});
 }
 for(const [fragment,section] of [['slack-destinations','alerts'],['reports-configuration-title','projects']]){
  await page.goto(worker.origin+'/projects/synthetic-spool-settings/settings#'+fragment);await page.waitForFunction(section=>!document.getElementById('settings-'+section)?.hidden,section);assert.equal(await page.locator('#'+fragment).isVisible(),true);receipt.legacy.push({fragment,section,visible:true});
 }
 receipt.result='passed';console.log(JSON.stringify({result:receipt.result,sections:receipt.sections.length,screenshots:receipt.screenshots.length,head:receipt.head}));
}finally{await browser?.close();await worker.stop();await writeFile(packet+'/settings-proof.json',JSON.stringify(receipt,null,2)+'\n');}
