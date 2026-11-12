import {traceStep,traceStage,traceServer,traceBrowser} from './trace.mjs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';

async function runCopiedSetup(script,input){
 const child=spawn('bash',['-c',script],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
 child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,stdout,stderr}));});
 const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
 try{child.stdin.end(input);return await traceStep("ui/13 done",async()=> (done));}finally{clearTimeout(timer);}
}

export async function handoffPanel(browser,app,directory,issue){
 const captures=[],context=await traceStep("ui/17 browser.newContext",async()=> (browser.newContext({viewport:{width:1440,height:1000}})));
 try{
  await traceStep("ui/19 openGate",async()=> (openGate(context,app.origin)));
  const pairs=app.cookie.split('; ').filter(Boolean);await traceStep("ui/20 context.addCookies",async()=> (context.addCookies(pairs.map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})))));
  const page=await traceStep("ui/21 context.newPage",async()=> (context.newPage()));await traceStep("ui/21 page.goto",async()=> (page.goto(app.origin+'/projects/a/settings')));await traceStep("ui/21 page.waitForLoadState",async()=> (page.waitForLoadState('networkidle')));
  const minted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/projects/a/keys'&&r.request().method()==='POST');
  await traceStep("ui/23 page.getByRole(button,{name:Create agent key,exact:true}).click",async()=> (page.getByRole('button',{name:'Create agent key',exact:true}).click()));const grant=await traceStep("ui/23 (await minted).json",async()=> ((await traceStep("ui/23 minted",async()=> (minted))).json()));
  const panel=page.locator('.agent-handoff');await traceStep("ui/24 panel.locator([data-agent-command]).waitFor",async()=> (panel.locator('[data-agent-command]').waitFor()));
  const setup=await traceStep("ui/25 panel.locator([data-agent-command]).innerText",async()=> (panel.locator('[data-agent-command]').innerText()));assert.ok(!setup.includes(grant.key));assert.ok(setup.includes(app.origin+'/api/projects/a'));assert.equal(await traceStep("ui/25 panel.locator([data-secret=\"agent-key\"]).innerText",async()=> (panel.locator('[data-secret="agent-key"]').innerText())),grant.key,'once-shown key retained');
  const runtime=await traceStep("ui/26 app.json",async()=> (app.json('/api/agent-runtime')));await traceStep("ui/26 access",async()=> (access(runtime.node,constants.X_OK)));await traceStep("ui/26 access",async()=> (access(runtime.cli)));assert.ok(setup.includes(runtime.node)&&setup.includes(runtime.cli),'the copyable command uses real runtime paths');
  for(const options of [{headers:{Cookie:''}},{agent:grant.key},{agent:grant.key,headers:{Cookie:app.cookie}}]){
   const denied=await traceStep("ui/28 app.request",async()=> (app.request('/api/agent-runtime','GET',undefined,options)));assert.equal(denied.status,401);const text=await traceStep("ui/28 denied.text",async()=> (denied.text()));assert.ok(!text.includes(runtime.node)&&!text.includes(runtime.cli),'anonymous and project-agent calls cannot discover local paths');
  }
  const notice=panel.locator('.agent-policy-notice');
  assert.equal(await traceStep("ui/31 notice.evaluate",async()=> (notice.evaluate(element=>!!(element.compareDocumentPosition(document.querySelector('[data-secret="agent-key"]'))&Node.DOCUMENT_POSITION_FOLLOWING)))),true,'policy prerequisite precedes the key and commands');
  assert.equal((await traceStep("ui/32 app.json",async()=> (app.json('/agents/api/state')))).policy.complete,false,'this is a real unsaved policy');
  async function capture(name,locator){
   for(const width of [1440,390]){await traceStep("ui/34 page.setViewportSize",async()=> (page.setViewportSize({width,height:1000})));await traceStep("ui/34 locator.scrollIntoViewIfNeeded",async()=> (locator.scrollIntoViewIfNeeded()));const path=`${directory}/${name}-${width}.png`;await traceStep("ui/34 locator.screenshot",async()=> (locator.screenshot({path,mask:[page.locator('[data-secret]')]})));captures.push(path);}
   await traceStep("ui/35 page.setViewportSize",async()=> (page.setViewportSize({width:1440,height:1000})));
  }
  async function accessible(){
   assert.equal(await traceStep("ui/38 page.evaluate",async()=> (page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))),true);
   const audit=await traceStep("ui/39 new AxeBuilder({page}).withTags([wcag2a,wcag2aa,wcag21aa]).analyze",async()=> (new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()));assert.deepEqual(audit.violations.map(row=>row.id),[]);
  }
  await traceStep("ui/41 accessible",async()=> (accessible()));await traceStep("ui/41 capture",async()=> (capture('agent-handoff-policy-needed',panel)));
  await traceStep("ui/42 context.grantPermissions",async()=> (context.grantPermissions(['clipboard-read','clipboard-write'])));await traceStep("ui/42 panel.getByRole(button,{name:Copy setup lines,exact:true}).click",async()=> (panel.getByRole('button',{name:'Copy setup lines',exact:true}).click()));assert.equal(await traceStep("ui/42 page.evaluate",async()=> (page.evaluate(()=>navigator.clipboard.readText()))),setup,'copied setup contains only displayed commands');
  await traceStep("ui/43 panel.getByRole(button,{name:Copy agent key,exact:true}).click",async()=> (panel.getByRole('button',{name:'Copy agent key',exact:true}).click()));assert.equal(await traceStep("ui/43 page.evaluate",async()=> (page.evaluate(()=>navigator.clipboard.readText()))),grant.key,'key copied separately');await traceStep("ui/43 page.evaluate",async()=> (page.evaluate(()=>navigator.clipboard.writeText(''))));
  // The real prerequisite link keeps the once-shown key available in this tab.
  const opened=page.waitForEvent('popup');await traceStep("ui/45 notice.getByRole(link).click",async()=> (notice.getByRole('link').click()));const policyPage=await traceStep("ui/45 opened",async()=> (opened));
  const form=policyPage.locator('[data-create-policy]');await traceStep("ui/46 form.waitFor",async()=> (form.waitFor()));await traceStep("ui/46 policyPage.waitForLoadState",async()=> (policyPage.waitForLoadState('networkidle')));
  for(const select of await traceStep("ui/47 form.locator([data-policy-class]).all",async()=> (form.locator('[data-policy-class]').all())))await traceStep("ui/47 select.selectOption",async()=> (select.selectOption('autonomous')));
  await traceStep("ui/48 form.locator(input[name=\"paidAI\"][value=\"no\"]).check",async()=> (form.locator('input[name="paidAI"][value="no"]').check()));
  const saved=policyPage.waitForResponse(response=>new URL(response.url()).pathname==='/agents/api/policy'&&response.request().method()==='PUT',{timeout:30000});
  await traceStep("ui/50 form.getByRole(button,{name:Save policy,exact:true}).click",async()=> (form.getByRole('button',{name:'Save policy',exact:true}).click()));assert.equal((await traceStep("ui/50 saved",async()=> (saved))).status(),200);assert.equal((await traceStep("ui/50 app.json",async()=> (app.json('/agents/api/state')))).policy.complete,true);await traceStep("ui/50 policyPage.close",async()=> (policyPage.close()));await traceStep("ui/50 page.bringToFront",async()=> (page.bringToFront()));
  assert.equal(await traceStep("ui/51 panel.locator([data-secret=\"agent-key\"]).innerText",async()=> (panel.locator('[data-secret="agent-key"]').innerText())),grant.key,'following and saving policy preserves the once-shown key');
  const packet=await traceStep("ui/52 app.json",async()=> (app.json(`/api/projects/a/issues/${issue}/packet`)));
  const result=await traceStep("ui/53 runCopiedSetup",async()=> (runCopiedSetup(setup,`${grant.key}\n${app.devKey}\n${packet.issue.short_id}\n`)));assert.equal(result.code,0,'copied Settings command reads the displayed short ID');assert.ok(result.stdout.includes(packet.issue.short_id));assert.ok(!result.stdout.includes(grant.key)&&!result.stderr.includes(app.devKey),'copied command keeps credentials private');
  await traceStep("ui/54 page.reload",async()=> (page.reload()));await traceStep("ui/54 page.getByRole(button,{name:Create agent key,exact:true}).waitFor",async()=> (page.getByRole('button',{name:'Create agent key',exact:true}).waitFor()));assert.equal(await traceStep("ui/54 page.locator(.agent-handoff).count",async()=> (page.locator('.agent-handoff').count())),0);assert.ok(!(await traceStep("ui/54 page.locator(body).innerText",async()=> (page.locator('body').innerText()))).includes(grant.key));
  const setupReads=[];page.on('request',request=>{if(['/api/agent-runtime','/agents/api/state'].includes(new URL(request.url()).pathname))setupReads.push(request.url());});
  await traceStep("ui/56 page.goto",async()=> (page.goto(`${app.origin}/projects/a/issues/${issue}`)));await traceStep("ui/56 page.locator(.short-id).waitFor",async()=> (page.locator('.short-id').waitFor()));assert.equal(await traceStep("ui/56 page.locator(.short-id).innerText",async()=> (page.locator('.short-id').innerText())),packet.issue.short_id);
  const downloadButton=page.getByRole('button',{name:'Download evidence (raw JSON)',exact:true}).filter({visible:true});
  const downloaded=page.waitForEvent('download');await traceStep("ui/58 downloadButton.click",async()=> (downloadButton.click()));const download=await traceStep("ui/58 downloaded",async()=> (downloaded));
  assert.deepEqual(JSON.parse(await traceStep("ui/59 readFile",async()=> (readFile(await traceStep("ui/59 download.path",async()=> (download.path())),'utf8')))),await traceStep("ui/59 app.json",async()=> (app.json(`/api/projects/a/issues/${issue}/packet`))),'raw-labelled download retains the complete packet');
  assert.deepEqual(setupReads,[],'ordinary issue viewing and download start no agent-setup requests');
  await traceStep("ui/61 page.getByRole(button,{name:Details: Hand this issue to your agent,exact:true}).click",async()=> (page.getByRole('button',{name:'Details: Hand this issue to your agent',exact:true}).click()));
  const dialog=page.getByRole('dialog',{name:'Hand this issue to your agent',exact:true});await traceStep("ui/62 dialog.locator([data-agent-command]).waitFor",async()=> (dialog.locator('[data-agent-command]').waitFor()));
  const issueSetup=await traceStep("ui/63 dialog.locator([data-agent-command]).innerText",async()=> (dialog.locator('[data-agent-command]').innerText()));assert.ok(issueSetup.includes(runtime.node)&&issueSetup.includes(runtime.cli));assert.ok(issueSetup.includes(packet.issue.short_id));
  await traceStep("ui/64 dialog.getByRole(button,{name:Copy setup lines,exact:true}).click",async()=> (dialog.getByRole('button',{name:'Copy setup lines',exact:true}).click()));assert.equal(await traceStep("ui/64 page.evaluate",async()=> (page.evaluate(()=>navigator.clipboard.readText()))),issueSetup);
  const issueResult=await traceStep("ui/65 runCopiedSetup",async()=> (runCopiedSetup(issueSetup,`${grant.key}\n${app.devKey}\n`)));assert.equal(issueResult.code,0,'issue command runs without a manual issue substitution');assert.equal(issueResult.stdout,result.stdout,'Settings and issue commands read the same packet');
  await traceStep("ui/66 accessible",async()=> (accessible()));await traceStep("ui/66 capture",async()=> (capture('issue-agent-command',dialog)));
  await traceStep("ui/67 dialog.getByRole(button,{name:Close details,exact:true}).click",async()=> (dialog.getByRole('button',{name:'Close details',exact:true}).click()));await traceStep("ui/67 capture",async()=> (capture('issue-evidence',page.locator('body'))));
 }finally{await traceStep("ui/68 context.close",async()=> (context.close()));}
 return captures;
}
