// Report-only browser proof. Run from the product checkout; no test registration.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const load=name=>import(pathToFileURL(process.cwd()+'/tests/'+name));
const {startTestWorker}=await load('worker.mjs'),{signIn}=await load('auth.mjs'),{launchBrowser}=await load('browser-launch.mjs');
const directory=process.env.SPOOL_SETTINGS_PACKET;
assert.ok(directory);
await mkdir(directory+'/screens',{recursive:true});
const worker=await startTestWorker(15483);let browser;
const result={candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),screens:[],legacy:[]};
const sections=[['organization','Organization'],['projects','Projects & keys'],['processing','Issue processing'],['alerts','Alerts & integrations'],['privacy','Privacy & filtering'],['data','Data & archive'],['audit','Audit']];
try{
 const origin=worker.origin,cookie=await signIn(origin);
 const response=await fetch(origin+'/api/projects',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:'cedar',name:'Cedar Dispatch'})});assert.equal(response.status,201);await response.body.cancel();
 browser=await launchBrowser();
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await context.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));
   const page=await context.newPage();page.setDefaultTimeout(15000);
   await page.goto(origin+'/projects/cedar/settings');
   const navigation=page.getByRole('navigation',{name:'Settings sections'});await navigation.waitFor();
   assert.deepEqual(await navigation.getByRole('link').allTextContents(),sections.map(([,label])=>label));
   for(const [id,label]of sections){
    await navigation.getByRole('link',{name:label,exact:true}).click();
    await page.locator('#settings-'+id+':visible').waitFor();await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.settings-section:visible').count(),1);
    assert.equal(new URL(page.url()).hash,'#settings-'+id);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const file='screens/settings-'+id+'-'+width+'.jpg';
    await page.screenshot({path:directory+'/'+file,type:'jpeg',quality:85,fullPage:true,mask:[page.locator('.secret-key,input[type="password"],[data-secret]')]});
    result.screens.push({width,section:id,label,address:'/projects/cedar/settings#settings-'+id,file,headings:await page.locator('#settings-'+id).getByRole('heading').allTextContents(),overflow:false});
   }
   for(const [hash,id]of [['slack-destinations','alerts'],['reports-configuration-title','projects']]){
    await page.goto(origin+'/projects/cedar/settings#'+hash);await page.locator('#settings-'+id+':visible').waitFor();
    assert.equal(await navigation.getByRole('link',{name:sections.find(row=>row[0]===id)[1],exact:true}).getAttribute('aria-current'),'page');
    result.legacy.push({width,fragment:hash,section:id});
   }
  }finally{await context.close()}
 }
}finally{await browser?.close();await worker.stop()}
await writeFile(directory+'/settings-browser-receipt.json',JSON.stringify(result,null,2)+'\n');
console.log('Settings browser proof passed: '+result.screens.length+' screens at 1440 and 390; '+result.legacy.length+' legacy fragment checks.');
