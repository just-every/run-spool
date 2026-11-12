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
 try{child.stdin.end(input);return await done;}finally{clearTimeout(timer);}
}

export async function handoffPanel(browser,app,directory,issue){
 const captures=[],context=await browser.newContext({viewport:{width:1440,height:1000}});
 try{
  await openGate(context,app.origin);
  const pairs=app.cookie.split('; ').filter(Boolean);await context.addCookies(pairs.map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
  const page=await context.newPage();await page.goto(app.origin+'/projects/a/settings#settings-projects');await page.waitForLoadState('networkidle');
  const minted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/projects/a/keys'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create agent key',exact:true}).click();const grant=await (await minted).json();
  const panel=page.locator('.agent-handoff');await panel.locator('[data-agent-command]').waitFor();
  const setup=await panel.locator('[data-agent-command]').innerText();assert.ok(!setup.includes(grant.key));assert.ok(setup.includes(app.origin+'/api/projects/a'));assert.equal(await panel.locator('[data-secret="agent-key"]').innerText(),grant.key,'once-shown key retained');
  const runtime=await app.json('/api/agent-runtime');await access(runtime.node,constants.X_OK);await access(runtime.cli);assert.ok(setup.includes(runtime.node)&&setup.includes(runtime.cli),'the copyable command uses real runtime paths');
  for(const options of [{headers:{Cookie:''}},{agent:grant.key},{agent:grant.key,headers:{Cookie:app.cookie}}]){
   const denied=await app.request('/api/agent-runtime','GET',undefined,options);assert.equal(denied.status,401);const text=await denied.text();assert.ok(!text.includes(runtime.node)&&!text.includes(runtime.cli),'anonymous and project-agent calls cannot discover local paths');
  }
  const notice=panel.locator('.agent-policy-notice');
  assert.equal(await notice.evaluate(element=>!!(element.compareDocumentPosition(document.querySelector('[data-secret="agent-key"]'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'policy prerequisite precedes the key and commands');
  assert.equal((await app.json('/agents/api/state')).policy.complete,false,'this is a real unsaved policy');
  async function capture(name,locator){
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await locator.scrollIntoViewIfNeeded();const path=`${directory}/${name}-${width}.png`;await locator.screenshot({path,mask:[page.locator('[data-secret]')]});captures.push(path);}
   await page.setViewportSize({width:1440,height:1000});
  }
  async function accessible(){
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[]);
  }
  await accessible();await capture('agent-handoff-policy-needed',panel);
  await context.grantPermissions(['clipboard-read','clipboard-write']);await panel.getByRole('button',{name:'Copy setup lines',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),setup,'copied setup contains only displayed commands');
  await panel.getByRole('button',{name:'Copy agent key',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),grant.key,'key copied separately');await page.evaluate(()=>navigator.clipboard.writeText(''));
  // The real prerequisite link keeps the once-shown key available in this tab.
  const opened=page.waitForEvent('popup');await notice.getByRole('link').click();const policyPage=await opened;
  const form=policyPage.locator('[data-create-policy]');await form.waitFor();await policyPage.waitForLoadState('networkidle');
  for(const select of await form.locator('[data-policy-class]').all())await select.selectOption('autonomous');
  await form.locator('input[name="paidAI"][value="no"]').check();
  const saved=policyPage.waitForResponse(response=>new URL(response.url()).pathname==='/agents/api/policy'&&response.request().method()==='PUT',{timeout:30000});
  await form.getByRole('button',{name:'Save policy',exact:true}).click();assert.equal((await saved).status(),200);assert.equal((await app.json('/agents/api/state')).policy.complete,true);await policyPage.close({runBeforeUnload:true});await page.bringToFront();
  assert.equal(await panel.locator('[data-secret="agent-key"]').innerText(),grant.key,'following and saving policy preserves the once-shown key');
  const packet=await app.json(`/api/projects/a/issues/${issue}/packet`);
  const result=await runCopiedSetup(setup,`${grant.key}\n${app.devKey}\n${packet.issue.short_id}\n`);assert.equal(result.code,0,'copied Settings command reads the displayed short ID');assert.ok(result.stdout.includes(packet.issue.short_id));assert.ok(!result.stdout.includes(grant.key)&&!result.stderr.includes(app.devKey),'copied command keeps credentials private');
  await page.reload();await page.getByRole('button',{name:'Create agent key',exact:true}).waitFor();assert.equal(await page.locator('.agent-handoff').count(),0);assert.ok(!(await page.locator('body').innerText()).includes(grant.key));
  const setupReads=[];page.on('request',request=>{if(['/api/agent-runtime','/agents/api/state'].includes(new URL(request.url()).pathname))setupReads.push(request.url());});
  await page.goto(`${app.origin}/projects/a/issues/${issue}`);await page.locator('.short-id').waitFor();assert.equal(await page.locator('.short-id').innerText(),packet.issue.short_id);
  const downloadButton=page.getByRole('button',{name:'Download evidence (raw JSON)',exact:true}).filter({visible:true});
  const downloaded=page.waitForEvent('download');await downloadButton.click();const download=await downloaded;
  assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),await app.json(`/api/projects/a/issues/${issue}/packet`),'raw-labelled download retains the complete packet');
  assert.deepEqual(setupReads,[],'ordinary issue viewing and download start no agent-setup requests');
  await page.getByRole('button',{name:'Details: Hand this issue to your agent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Hand this issue to your agent',exact:true});await dialog.locator('[data-agent-command]').waitFor();
  const issueSetup=await dialog.locator('[data-agent-command]').innerText();assert.ok(issueSetup.includes(runtime.node)&&issueSetup.includes(runtime.cli));assert.ok(issueSetup.includes(packet.issue.short_id));
  await dialog.getByRole('button',{name:'Copy setup lines',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),issueSetup);
  const issueResult=await runCopiedSetup(issueSetup,`${grant.key}\n${app.devKey}\n`);assert.equal(issueResult.code,0,'issue command runs without a manual issue substitution');assert.equal(issueResult.stdout,result.stdout,'Settings and issue commands read the same packet');
  await accessible();await capture('issue-agent-command',dialog);
  await dialog.getByRole('button',{name:'Close details',exact:true}).click();await capture('issue-evidence',page.locator('body'));
 }finally{await context.close();}
 return captures;
}
