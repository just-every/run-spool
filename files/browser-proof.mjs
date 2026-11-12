import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
if ((await import('node:fs')).existsSync('../packet/browser-proof.json')) { console.log('Settings proof already captured on this candidate; see browser-proof.json.'); process.exit(0); }
const root=process.cwd();
const {startTestWorker}=await import(pathToFileURL(root+'/tests/worker.mjs'));
const {signIn}=await import(pathToFileURL(root+'/tests/auth.mjs'));
const {launchBrowser}=await import(pathToFileURL(root+'/tests/browser-launch.mjs'));
const worker=await startTestWorker(15489);let browser;
const out='../packet/screens';await mkdir(out,{recursive:true});
const receipt={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),purpose:'Browser proof only; no new test',screens:[]};
try{
 const cookie=await signIn(worker.origin);
 const created=await fetch(worker.origin+'/api/projects',{method:'POST',headers:{Cookie:cookie,Origin:worker.origin,'Content-Type':'application/json'},body:JSON.stringify({id:'synthetic-spool-settings',name:'Synthetic Settings review'})});
 if(!created.ok)throw Error('Synthetic project setup failed: '+created.status);
 await created.body?.cancel();
 browser=await launchBrowser();
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  try{
   await context.addCookies(cookie.split('; ').filter(Boolean).map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:worker.origin})));
   const page=await context.newPage();
   for(const section of ['organization','projects','processing','alerts','privacy','data','audit']){
    await page.goto(worker.origin+'/projects/synthetic-spool-settings/settings#settings-'+section);
    await page.locator('#settings-'+section+':visible').waitFor();
    await page.waitForLoadState('networkidle');
    const file=`screens/settings-${section}-${width}.png`;
    await page.screenshot({path:'../packet/'+file,fullPage:true,mask:[page.locator('.secret-key,input[type="password"],[data-secret]')]});
    receipt.screens.push({section,width,file,fragment:new URL(page.url()).hash,current:await page.locator('.settings-navigation [aria-current="page"]').innerText(),pageWidth:await page.evaluate(()=>document.documentElement.scrollWidth)});
   }
  }finally{await context.close()}
 }
 await writeFile('../packet/browser-proof.json',JSON.stringify(receipt,null,2)+'\n');
 console.log('Captured all seven Settings sections at 1440 and 390; secrets masked.');
}finally{await browser?.close();await worker.stop()}
