import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const checkout=resolve(process.argv[2]),packet=resolve(process.argv[3]);
const load=path=>import(pathToFileURL(resolve(checkout,path)).href);
const [{admissionRuntime},{signIn},{rollbarFixture},{rollbarDoorClient},{launchBrowser}]=await Promise.all([
 load('tests/admission-runtime.mjs'),load('tests/auth.mjs'),load('tests/rollbar-import/fixture.mjs'),
 load('scripts/rollbar-import.mjs'),load('tests/browser-launch.mjs'),
]);
const runtime=await admissionRuntime({}, {hostedMail:true,networkEdge:async()=>{throw new Error('Unexpected outbound request');}});
let browser;
try {
 const origin=runtime.origin,cookie=await signIn(origin,{emailLink:true});
 const client=rollbarDoorClient({endpoint:origin,cookie,project:'71'});
 const plan=await client.plan(Buffer.from(JSON.stringify(rollbarFixture())));
 assert.equal(plan.counts.rejected,0);
 await client.apply(plan.planId,plan.fingerprint);
 const report=await client.reconcile(plan.planId);
 assert.equal(report.ok,true);
 const project=report.projectIds[0];
 const response=await fetch(origin+'/api/projects/'+project+'/issues',{headers:{Cookie:cookie}});
 assert.equal(response.status,200);
 const issues=await response.json(),observations=[];
 browser=await launchBrowser();
 const context=await browser.newContext(),split=cookie.indexOf('=');
 await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
 const page=await context.newPage();
 const paint=()=>page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 for(const [index,slug,language] of [[1,'python','python'],[2,null,'python'],[3,'node-zero',undefined],[4,null,undefined]]) {
  const issue=issues.find(row=>row.title==='Checkout failure '+(index+1));
  const result=await fetch(origin+'/api/projects/'+project+'/issues/'+issue.id+'/packet',{headers:{Cookie:cookie}});
  assert.equal(result.status,200);
  const evidence=await result.json(),event=evidence.events[0].event;
  assert.equal(event.language,language);
  assert.equal(event.frames.length,2);
  assert.equal(event.frames[0].column,index<3?null:index===3?0:4);
  assert.deepEqual(event.frames,report.comparison.stacks[index].nativeFrames);
  observations.push({sourceId:report.comparison.stacks[index].sourceId,sourceFrames:report.comparison.stacks[index].sourceFrames,nativeFrames:event.frames,language:event.language??'javascript'});
  if(slug)for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   await page.goto(origin+'/projects/'+project+'/issues/'+issue.id);
   await page.getByRole('heading',{name:issue.title,exact:true}).waitFor();
   await page.locator('.frame-coordinate').first().waitFor();
   await paint();
   const bytes=await page.screenshot({path:resolve(packet,slug+'-'+width+'.png'),fullPage:true,animations:'disabled'});
   assert.ok(bytes.length>10000,'rendered proof contains the populated issue');
  }
 }
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(origin+'/projects/'+project+'/settings');
  await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
  await page.getByText('rollbar-project:71',{exact:true}).waitFor();
  await paint();
  const bytes=await page.screenshot({path:resolve(packet,'history-'+width+'.png'),animations:'disabled'});
  assert.ok(bytes.length>10000,'rendered proof contains import history');
 }
 const result={head:execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),reconciliationOk:report.ok,observations,screenshots:['python-1440.png','python-390.png','node-zero-1440.png','node-zero-390.png','history-1440.png','history-390.png']};
 await writeFile(resolve(packet,'PROBE.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
} finally {await browser?.close();await runtime.close();}
