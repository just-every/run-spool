import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {execFileSync} from 'node:child_process';
import {startTestWorker} from '../tests/worker.mjs';
import {firstProjectJourney} from '../tests/setup-journey.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
import {signIn,gate,testDevKey} from '../tests/auth.mjs';
import {runtime} from '../tests/owner-erasure/helpers.mjs';
import {browserMembers,localMailFlow} from '../tests/team-browser.mjs';
import {ownerSetupFlow} from '../tests/owner-setup-flow.mjs';
const receipt={headAtTest:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),treeDiff:execFileSync('git',['diff','--cached','--stat'],{encoding:'utf8'}).trim(),assertionWidth:1440,proofWidths:[1440,390],started_utc:new Date().toISOString(),checks:[]};
const done=name=>{receipt.checks.push(name);console.log('DESIGN_CHECK '+name)};
const privateLog=openSync('/tmp/spool-dev-proof.log','w',0o600);
const dev=spawn(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs','dev','--foreground','--port','15530','--json'],{stdio:['ignore',privateLog,privateLog]});closeSync(privateLog);
const closed=new Promise(resolve=>dev.once('close',resolve));
const app={origin:'http://127.0.0.1:15530',stop:async()=>{dev.kill('SIGINT');await closed;gate.key=testDevKey;}};let browser;
try{
 let ready=false;for(let i=0;i<600;i++){
  if(dev.exitCode!==null)throw Error('Real rer dev stopped before readiness; private log retained outside packet.');
  if(await fetch(app.origin+'/health').then(async r=>{await r.body?.cancel();return r.ok;},()=>false)){ready=true;break;}
  await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready,'real rer dev becomes healthy');gate.key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile('.rer/local/dev-key.env','utf8'))[1];browser=await launchBrowser();
 await firstProjectJourney(browser,app.origin,1440);done('first-project identity, keyboard flow, real capture, website allow, key copy and source-map journey');
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 await mkdir('.artifacts/design-docs',{recursive:true});
 for(const [name,path] of [['getting-started','/docs/getting-started'],['capture','/docs/capture']]){
  const response=await page.goto(app.origin+path);assert.equal(response.status(),200);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.artifacts/design-docs/${name}-${width}.png`,fullPage:true});}
 }
 await context.close();done('public getting-started and capture docs render at both proof widths');
}finally{await browser?.close();await app.stop();}
const worker=await runtime();
try{
 const origin=worker.origin,cookie=worker.cookie;
 const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,Connection:'close',...(value!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(value!==undefined?{body:JSON.stringify(value)}:{})});
 const json=async(...args)=>{const response=await req(...args);assert.ok(response.ok,args[0]+' '+response.status);return response.json();};
 const owner={origin,cookie,req,json};
 await json('/api/organization','POST',{id:'synthetic-spool-setup',name:'Cedar Operations'});
 const projects=[];for(const [id,name] of [['cedar','Cedar checkout'],['cedar-back','Cedar back office']])projects.push(await json('/api/projects','POST',{id,name}));
 await browserMembers(owner,projects);
 const proofBrowser=await launchBrowser();try{
  const context=await proofBrowser.newContext({viewport:{width:1440,height:1000}}),split=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();await page.goto(origin+'/projects/cedar/settings#settings-general');
  await page.getByLabel('Installation name',{exact:true}).waitFor();await mkdir('.artifacts/design-general',{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.artifacts/design-general/general-${width}.png`,fullPage:true,mask:[page.locator('.secret-key, [data-secret]')]});}
 }finally{await proofBrowser.close();}
 done('organization rename, personal name/email editing, immediately visible member invitations and current-role safeguards');
}finally{await worker.close();}
await localMailFlow();done('local invitations, duplicate recovery and invitee authority');
await ownerSetupFlow();done('owner capture/key lifecycle, scoped team mapping and archive restore');
receipt.finished_utc=new Date().toISOString();receipt.completed=true;await writeFile('.artifacts/design-setup-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log('Prepared design setup checks passed.');
