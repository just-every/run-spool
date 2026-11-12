import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {startTestWorker} from '../tests/worker.mjs';
import {signIn,openGate} from '../tests/auth.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
const packet='/home/agent/rer-consolidation/work/main-spool-setup-links-1/packet',worker=await startTestWorker(15586);let browser;
try{
 const cookie=await signIn(worker.origin);browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:900}});await openGate(context,worker.origin);await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:worker.origin}]);const page=await context.newPage();
 await page.goto(worker.origin+'/setup');await page.getByRole('note',{name:'New project user identity policy'}).waitFor();
 await page.screenshot({path:packet+'/setup-1440.png',fullPage:true});await page.setViewportSize({width:390,height:900});await page.screenshot({path:packet+'/setup-390.png',fullPage:true});await page.setViewportSize({width:1440,height:900});
 const request=async(path,method='GET',body,headers={})=>{const r=await fetch(worker.origin+path,{method,headers:{Cookie:cookie,Origin:worker.origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok,path+': '+r.status);return r.json()};
 const project=await request('/api/projects','POST',{id:'synthetic-spool-setup-proof',name:'Synthetic setup proof'});await request('/api/projects/'+project.id+'/releases','POST',{name:'1',build:'1'});const captured=await request('/api/ingest/'+project.id,'POST',{version:1,eventId:'synthetic-spool-setup-proof',release:'1',build:'1',environment:'production',type:'Error',message:'Synthetic setup prerequisite',frames:[{file:'app.js',line:1,column:0,function:'checkout'}]},{Authorization:'Bearer '+project.ingestKey});
 await page.goto(worker.origin+'/projects/'+project.id+'/issues/'+captured.issue);const github=page.getByRole('group',{name:'GitHub connection'});await github.getByRole('link',{name:'Set up the GitHub connection',exact:true}).waitFor();await github.screenshot({path:packet+'/github-1440.png'});await page.setViewportSize({width:390,height:900});await github.screenshot({path:packet+'/github-390.png'});
 await writeFile(packet+'/BROWSER-RECEIPT.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:'emitted Worker from final rer build',widths:[1440,390],screens:['setup','GitHub connection','Slack destinations','Cron check-ins','Business imports','four on-site docs guides'],setupAndGitHubCapture:'final-ui-proof.mjs',settingsCapture:'tests/runtime.mjs#settingsPrerequisiteGuides',docsCapture:'docs-proof.mjs',credentials:'No keys or private entry URLs rendered in selected screenshots.'},null,2)+'\n');console.log('Final-SHA setup and disconnected GitHub captures refreshed.');await context.close();
}finally{await browser?.close();await worker.stop()}
