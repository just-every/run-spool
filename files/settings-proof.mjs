import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';

const output=process.env.HOME+'/rer-consolidation/work/main-spool-settings-split-1-c1/packet';
await mkdir(output+'/screens',{recursive:true});
const worker=await startTestWorker(16483);let browser;
const rows=[];
try{
 const cookie=await signIn(worker.origin);
 const created=await fetch(worker.origin+'/api/projects',{method:'POST',headers:{Cookie:cookie,Origin:worker.origin,'Content-Type':'application/json'},body:JSON.stringify({id:'synthetic-spool-settings',name:'Synthetic Spool Settings'})});
 assert.equal(created.status,201);
 browser=await launchBrowser();
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:worker.origin}]);
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const sections=['organization','projects','processing','alerts','privacy','data','audit'];
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  await page.goto(worker.origin+'/projects/synthetic-spool-settings/settings#settings-organization');
  const navigation=page.getByRole('navigation',{name:'Settings sections'});
  await navigation.waitFor();
  for(const section of sections){
   await navigation.locator('a[href="#settings-'+section+'"]').click();
   await page.locator('#settings-'+section+':not([hidden])').waitFor();
   await page.waitForLoadState('networkidle');
   const facts=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,visibleSections:[...document.querySelectorAll('.settings-section:not([hidden])')].map(e=>e.id),navigation:[...document.querySelectorAll('.settings-navigation a')].map(e=>({text:e.textContent,href:e.getAttribute('href'),current:e.getAttribute('aria-current'),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),headings:[...document.querySelector('.settings-section:not([hidden])').querySelectorAll('h2,h3')].map(e=>e.textContent)}));
   if(width===1440){assert.deepEqual(facts.visibleSections,['settings-'+section]);assert.equal(facts.documentWidth<=width+1,true);}
   const file='screens/settings-'+section+'-'+width+'.png';
   await page.screenshot({path:output+'/'+file,fullPage:true,mask:[page.locator('.secret-key, input[type="password"], [data-secret]')]});
   rows.push({section,width,file,...facts});
  }
 }
 await context.close();
 await writeFile(output+'/settings-browser.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),screens:rows},null,2)+'\n');
 console.log('Settings proof complete: seven sections at 1440 and 390; 14 screenshots.');
}finally{await browser?.close();await worker.stop();}
