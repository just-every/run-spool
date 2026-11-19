import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';
import {runner} from './reproduce.mjs';

// The issue leads to owner-only setup. The provider double witnesses a read-only test.
export async function disconnectedGitHubSetup(app,browser,directory,issue,github){
 const width=1440, context=await browser.newContext({viewport:{width,height:900}});
 try{
  await openGate(context,app.origin);
  await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
  const page=await context.newPage();await page.goto(`${app.origin}/projects/shop/issues/${issue}`);
  const connection=page.getByRole('group',{name:'GitHub connection',exact:true});
  await connection.getByText(/not configured/i).waitFor();
  await connection.getByRole('link',{name:/manage github connection/i}).click();
  const setup=page.getByRole('region',{name:'GitHub connection',exact:true});
  const guideLink=setup.getByRole('link',{name:/github connection guide/i});
  const href=await guideLink.getAttribute('href');assert.equal((await fetch(app.origin+href)).status,200,'GitHub guide opens anonymously');
  const index=await (await fetch(app.origin+'/docs')).text();assert.ok(index.includes(`href="${href}"`),'GitHub guide is reachable from docs index');
  await setup.getByRole('button',{name:'Set up connection'}).click();
  const {appId,installationId,privateKey}=JSON.parse(github.connection);
  await setup.getByLabel('App ID',{exact:true}).fill(appId);
  await setup.getByLabel('Installation ID',{exact:true}).fill(installationId);
  await setup.getByLabel(/private key/i).setInputFiles({name:'synthetic-spool-connection.pem',mimeType:'application/x-pem-file',buffer:Buffer.from(privateKey)});
  const prior=github.requests.length;
  const endpoint='/api/operator/github-connection', saved=page.waitForResponse(r=>r.url().endsWith(endpoint)&&r.request().method()==='PUT');
  await setup.getByRole('button',{name:'Connect GitHub',exact:true}).click();
  const savedResponse=await saved;assert.equal(savedResponse.status(),200);
  assert.ok(!(await savedResponse.text()).includes(privateKey.trim()),'response does not echo private key');
  await page.reload();await setup.getByRole('button',{name:'Test connection',exact:true}).waitFor();
  assert.equal(github.requests.length,prior,'saving and reloading does not contact GitHub');
  const tested=page.waitForResponse(r=>r.url().endsWith(endpoint+'/test'));
  await setup.getByRole('button',{name:'Test connection',exact:true}).click();
  assert.equal((await tested).status(),200);
  assert.deepEqual(github.requests.slice(prior),[{method:'GET',path:`/app/installations/${installationId}`,body:null,token:'app-jwt'}]);
  const archive=await (await app.request('/api/archive')).text();
  const manifest=JSON.parse(archive.split('\n',1)[0]);
  assert.ok(!manifest.tables.some(table=>table.name==='spool_github_connection'));
  assert.ok(!archive.includes(privateKey.split('\n')[1]),'the private key bytes are absent from the archive');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const path=`${directory}/github-setup-${width}.png`;await setup.screenshot({path});
  await setup.getByRole('button',{name:'Remove saved connection',exact:true}).click();
  await setup.getByRole('button',{name:'Set up connection',exact:true}).waitFor();
  return [path];
 }finally{await context.close();}
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
   await page.waitForResponse(response=>response.url().includes('/reproducers?issue=')&&response.ok(),{timeout:30000});
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
