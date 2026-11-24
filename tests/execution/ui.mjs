import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';
import {runner} from './reproduce.mjs';

// An owner reaches the disconnected integration through the real issue page.
// Its limits must be visible before opening details or approving a grant.
export async function disconnectedGitHubSetup(app,browser,directory,issue){
 const captures=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);
   await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
   const page=await context.newPage();await page.goto(`${app.origin}/projects/shop/issues/${issue}`);
   const connection=page.getByRole('group',{name:'GitHub connection',exact:true});
   await connection.getByRole('status').filter({hasText:/not configured/i}).waitFor();
   assert.equal(await connection.getByRole('button',{name:'Check connection',exact:true}).count(),0,'no connection check is offered without credentials');
   const guideLink=connection.getByRole('link',{name:'GitHub connection guide',exact:true});await guideLink.waitFor();
   if(width===1440){
    const href=await guideLink.getAttribute('href');assert.equal(new URL(href,app.origin).origin,app.origin,'GitHub setup stays on this install');
    await guideLink.click();await page.locator('article').waitFor();
    assert.equal((await fetch(page.url())).status,200,'GitHub guide opens anonymously');
    const index=await (await fetch(app.origin+'/docs')).text();assert.ok(index.includes(`href="${new URL(page.url()).pathname}"`),'GitHub guide is reachable from docs index');
    const hosted=page.getByRole('heading',{name:'Hosted Spool',exact:true});await hosted.waitFor();
    const command=await page.locator('article pre').filter({hasText:/--set-secret/}).innerText();
    assert.match(command,/rer deploy .*--env-file .*--set-secret GITHUB_CONNECTION/,'the hosted procedure uses the optional deployment secret command and a private env file');
    await page.goBack();await connection.getByRole('status').filter({hasText:/not configured/i}).waitFor();
   }
   const path=`${directory}/github-disconnected-${width}.png`;await connection.screenshot({path});captures.push(path);
   await connection.getByRole('button',{name:/connection limits/i}).click();
   const dialog=page.getByRole('dialog',{name:/GitHub connection limits/i});
   await dialog.getByRole('link',{name:/operator procedure/i}).waitFor();
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`disconnected GitHub setup fits at ${width}`);
  }finally{await context.close();}
 }
 return captures;
}

export async function connectedGitHubSetup(app,browser,github,issue,agentKey,directory){
 const path='/api/projects/shop/fixes/connection-check';
 const before=github.requests.length, workflowsPath=`/api/projects/shop/fixes?issue=${issue}`;
 const snapshot=await app.json(workflowsPath);
 for(const [headers,status] of [
  [{Cookie:''},401],
  [{Authorization:`Bearer ${agentKey}`},403],
  [{Origin:'https://elsewhere.example'},403],
 ]){
  const result=await app.request(path,'POST',undefined,headers);
  assert.equal(result.status,status,'the connection check requires a same-origin installation owner session');
  await result.body?.cancel();
 }
 assert.equal(github.requests.length,before,'refused calls did not contact GitHub');
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 try{
  await openGate(context,app.origin);
  await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
  const page=await context.newPage();await page.goto(`${app.origin}/projects/shop/issues/${issue}`);
  const connection=page.getByRole('group',{name:'GitHub connection',exact:true});
  const capture=async state=>{for(const width of [1440,390]){await page.setViewportSize({width,height:900});await connection.screenshot({path:`${directory}/github-${state}-${width}.png`});}await page.setViewportSize({width:1440,height:900});};
  const check=connection.getByRole('button',{name:'Check connection',exact:true});await check.waitFor();
  assert.equal(github.requests.length,before,'viewing a configured connection is inert');
  const reply=page.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==='POST');
  await check.click();
  const response=await reply;assert.equal(response.status(),200);const result=await response.json();assert.equal(result.ok,true,JSON.stringify(result));
  await connection.getByRole('status').filter({hasText:/GitHub confirmed access/}).waitFor();
  await capture('confirmed');
  github.state.refuseInstallationCheck=true;
  await check.click();
  await connection.getByRole('status').filter({hasText:/GitHub refused access/}).waitFor();
  await capture('refused');
  assert.equal(await connection.getByText('synthetic-spool-provider-private-detail').count(),0,'provider text is hidden');
  github.state.refuseInstallationCheck=false;github.state.redirectInstallationCheck=true;
  await check.click();
  await connection.getByRole('status').filter({hasText:/GitHub could not check/}).waitFor();
  const requests=github.requests.slice(before);
  assert.equal(requests.length,3,'redirects never receive the App credential');
  for(const {method,path,body,token} of requests){
   assert.equal(method,'GET');
   assert.match(path,/^\/app\/installations\/\d+$/);
   assert.equal(body,null);
   assert.equal(token,'app-jwt');
  }
  assert.equal(github.live(),0,'checking never mints an installation token');
  assert.deepEqual(await app.json(workflowsPath),snapshot,'checking cannot modify the grant, workflow or receipts');
 }finally{github.state.refuseInstallationCheck=false;github.state.redirectInstallationCheck=false;await context.close();}
}

// The issue page's reproduce-and-fix section at 1440 and 390: axe, no
// horizontal overflow, and a sandbox run queued by clicking and then run.
export async function executionPanel(app,browser,directory,issue,reproducer){
 const captures=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);
   await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
   const page=await context.newPage();await page.goto(`${app.origin}/projects/shop/issues/${issue}`);
   const section=page.locator('section.execution');await section.getByRole('heading',{name:'Reproduce and fix'}).waitFor();
   await section.getByText('After the deploy: Reached the affected users').waitFor();
   const card=section.locator('article.reproducer').filter({hasText:'Exact input'}).filter({hasText:'lineCount(…)'}).first();
   const before=await card.locator('.run.reproduced').count();
   await card.getByRole('button',{name:'Queue sandbox run'}).click();
   const command=await section.locator('.run-ticket code').innerText();
   const result=await runner(command);assert.equal(result.code,0,result.output);
   // The issue re-reads on return to the tab; a window focus is that return.
   await Promise.all([page.waitForResponse(response=>response.url().includes('/reproducers?issue=')&&response.ok(),{timeout:30000}),page.evaluate(()=>window.dispatchEvent(new Event('focus')))]);
   await page.waitForFunction(([count])=>document.querySelectorAll('section.execution article.reproducer .run.reproduced').length>count,[before]);
   // The exact grant opens in its dialog; Escape returns.
   await section.getByRole('button',{name:'Details: Exact grant'}).first().click();
   const dialog=page.getByRole('dialog',{name:'Exact grant'});await dialog.getByText('revoked after each step').waitFor();
   const grant=`${directory}/execution-grant-${width}.png`;await page.screenshot({path:grant});captures.push(grant);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`no horizontal overflow at ${width}`);
   const audit=await new AxeBuilder({page}).include('section.execution').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   assert.deepEqual(audit.violations.map(row=>row.id),[],`axe at ${width}`);
   const path=`${directory}/execution-${width}.png`;await section.screenshot({path});captures.push(path);
  }catch(error){for(const page of context.pages())await page.screenshot({path:`${directory}/failure-${width}.png`,fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
 }
 return captures;
}

export async function restoredExecutionPanel(app,browser,directory,issue){
 const captures=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
   const page=await context.newPage();await page.goto(`${app.origin}/projects/shop/issues/${issue}`);const section=page.locator('section.execution');
   await section.getByText('Restored history; no active grant',{exact:true}).first().waitFor();await section.getByText(/Historical result:/).first().waitFor();
   assert.equal(await section.locator('.fix-actions button').count(),0,'restored grants offer no dispatch controls');
   assert.equal(await section.getByRole('button',{name:'Propose fix branch',exact:true}).count(),0,'historical passing results offer no fix authority');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'restored execution fits');
   const audit=await new AxeBuilder({page}).include('section.execution').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[]);
   for(const [name,card] of [['fix',section.locator('article.fix').first()],['run',section.locator('article.reproducer').first()]]){const path=`${directory}/restored-${name}-${width}.png`;await card.screenshot({path});captures.push(path);}
  }finally{await context.close();}
 }
 return captures;
}
