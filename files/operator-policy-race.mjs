import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {startTestWorker}=await import(pathToFileURL(process.cwd()+'/tests/worker.mjs'));
const {signIn}=await import(pathToFileURL(process.cwd()+'/tests/auth.mjs'));
const {launchBrowser}=await import(pathToFileURL(process.cwd()+'/tests/browser-launch.mjs'));
let app,browser,failure,release;const held=[],result={checks:[]};
const gate=new Promise(r=>release=r);
try{
 app=await startTestWorker(15495);const origin=app.origin,cookie=await signIn(origin);
 const api=async(path,method='GET',body)=>{const r=await fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,'public API succeeds');return r.json()};
 const project=await api('/api/projects','POST',{id:'policy-race',name:'Policy race'}),root='/api/projects/policy-race';
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin}]);
 const page=await context.newPage();page.setDefaultTimeout(15000);
 await page.goto(origin+'/projects/policy-race/capture');await page.getByLabel('Project ingest key',{exact:true}).fill(project.ingestKey);
 const sent=page.waitForResponse(r=>r.url().endsWith('/api/ingest/policy-race')&&r.request().method()==='POST');await page.getByRole('button',{name:'Send the test error again',exact:true}).click();const sample=await(await sent).json();
 await page.goto(origin+'/projects/policy-race/issues/'+sample.issue);
 const open=async()=>{await page.getByRole('button',{name:'Details: Suppression policies',exact:true}).click();await page.getByRole('dialog').waitFor()};
 await open();await page.getByRole('dialog').getByRole('button',{name:'Add suppression policy',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('dialog[open] button.primary-button')?.disabled);
 result.initialValue=await page.getByLabel('Match value',{exact:true}).inputValue();await page.keyboard.press('Escape');
 await page.route('**/alerting/controls',async route=>{const response=await route.fetch();held.push(true);await gate;await route.fulfill({response})});
 const assignee=(await api(root+'/assignment-members')).members[0];
 await page.getByRole('combobox',{name:'Assign to',exact:true}).selectOption(assignee.id);await page.getByRole('button',{name:'Assign',exact:true}).click();
 for(let i=0;i<100&&!held.length;i++)await new Promise(r=>setTimeout(r,50));assert.ok(held.length,'refresh reads captured before mutation');
 await open();await page.getByLabel('Match value',{exact:true}).fill(result.initialValue);
 const saved=page.waitForResponse(r=>r.url().endsWith('/suppression-policies')&&r.request().method()==='POST');
 await page.getByRole('dialog').getByRole('button',{name:'Add suppression policy',exact:true}).click();assert.equal((await saved).status(),201);
 await page.getByRole('button',{name:'Disable policy',exact:true}).waitFor();assert.equal((await api(root+'/operator-state')).policies.length,1);result.checks.push('Policy save appears before held read release');
 release();await page.waitForLoadState('networkidle');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 result.heldReads=held.length;result.policyStillVisible=await page.getByRole('button',{name:'Disable policy',exact:true}).isVisible();result.apiPolicyCount=(await api(root+'/operator-state')).policies.length;
 assert.equal(result.policyStillVisible,true,'An older panel read must not hide the saved policy');result.checks.push('Saved policy survives older read');
}catch(error){failure=String(error.stack??error).replace(/https?:\/\/\S+/g,'[local URL omitted]')}
finally{release();await browser?.close();await app?.stop()}
result.ok=!failure;result.failure=failure;result.utc=new Date().toISOString();await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=failure?1:0;
