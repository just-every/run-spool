// Report-only reproduction of the stale-row window; no product test is added.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const load=name=>import(pathToFileURL(process.cwd()+'/tests/'+name));
const {startTestWorker}=await load('worker.mjs'),{signIn}=await load('auth.mjs'),{launchBrowser}=await load('browser-launch.mjs');
const worker=await startTestWorker(15483);let browser;
const report={baseline:'8ef55561973155476e8c9c8d98c1c7b2e80c8b70',mode:'Hold only the browser key-list refresh until the existing last row has been selected; release before the revoked-state assertion. No sleeps or retries.'};
try{
 const origin=worker.origin,cookie=await signIn(origin);
 const api=async(path,method='GET',value)=>{const response=await fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...value?{body:JSON.stringify(value)}:{}});assert.ok(response.ok);return response.json()};
 const project=await api('/api/projects','POST',{id:'cedar',name:'Cedar Dispatch'});await api('/api/projects/cedar/releases','POST',{name:'synthetic-spool-1',build:'synthetic-spool-1'});
 const ingest=async()=>{const response=await fetch(origin+'/api/ingest/cedar',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+project.ingestKey,'Content-Type':'application/json'},body:JSON.stringify({version:1,eventId:randomUUID(),type:'Error',message:'Synthetic key identity probe',release:'synthetic-spool-1',build:'synthetic-spool-1',environment:'production',frames:[{file:'https://app.test/synthetic-spool-1.js',line:1,column:0,function:'syntheticSpoolCapture'}]})});return {status:response.status,body:await response.json()}};
 const before=await ingest();assert.equal(before.body.outcome,'accepted');report.before_capture={status:before.status,outcome:before.body.outcome};
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));
 const page=await context.newPage();page.setDefaultTimeout(15000);await page.goto(origin+'/projects/cedar/settings#settings-projects');await page.locator('.key-row').waitFor();
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/projects/cedar/keys',async route=>{if(route.request().method()==='GET')await gate;await route.continue()});
 const created=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/projects/cedar/keys'&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Create deploy key',exact:true}).click();const creation=await created;assert.equal(creation.status(),201);const grant=await creation.json();
 await page.getByRole('button',{name:'Dismiss key',exact:true}).click();
 const key=page.locator('.key-row').last(),target=await key.getAttribute('data-key-hash');
 report.positional_selection={selected_created_key:target===grant.hash,selected_ingest_key:target===createHash('sha256').update(project.ingestKey).digest('hex')};
 assert.equal(report.positional_selection.selected_created_key,false);assert.equal(report.positional_selection.selected_ingest_key,true);
 await key.getByRole('button',{name:'Details: Project key',exact:true}).click();
 const revoked=page.waitForResponse(response=>response.request().method()==='DELETE'&&new URL(response.url()).pathname==='/api/projects/cedar/keys/'+target);
 await page.getByRole('dialog',{name:'Project key',exact:true}).getByRole('button',{name:'Revoke key',exact:true}).click();assert.equal((await revoked).status(),200);
 release();await page.getByRole('dialog',{name:'Project key',exact:true}).getByText('Revoked',{exact:true}).first().waitFor();
 const keys=await api('/api/projects/cedar/keys');report.after_keys={ingest_revoked:keys.find(row=>row.kind==='ingest').revoked!==null,created_deploy_active:keys.find(row=>row.hash===grant.hash).revoked===null};
 const after=await ingest();report.after_capture={status:after.status,outcome:after.body.outcome,reason:after.body.reason};assert.equal(after.body.outcome,'rejected');
}finally{await browser?.close();await worker.stop()}
await writeFile(process.env.SPOOL_SETTINGS_PACKET+'/baseline-key-race-receipt.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
