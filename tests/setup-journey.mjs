import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { assertSignInForm, openGate, testOwner } from './auth.mjs';
import AxeBuilder from '@axe-core/playwright';

// One real, empty installation per call. Enter the dev owner without
// JavaScript, then continue in a hydrated browser for the public project form.
export async function firstProjectJourney(browser, origin, width) {
 const viewport={width,height:900};
 const plain=await browser.newContext({javaScriptEnabled:false,viewport});
 let context;
 try {
  const signIn=await plain.newPage();await openGate(plain,origin);await signIn.goto(origin+'/sign-in');await assertSignInForm(signIn);
  await signIn.getByRole('link',{name:'Continue as owner',exact:true}).click();
  await signIn.waitForURL(origin+'/setup');
  context=await browser.newContext({viewport,storageState:await plain.storageState()});
  await plain.close();
  const page=await context.newPage();const consoleErrors=[];page.on('console',message=>{if(message.type()==='error'&&/pattern/i.test(message.text()))consoleErrors.push(message.text());});await page.goto(origin+'/setup');
  const request=context.request;
  assert.equal((await (await request.get(origin+'/api/projects')).json()).length,0);
  for(const path of ['/','/app','/projects/missing']){const response=await request.get(origin+path,{maxRedirects:0});assert.equal(response.status(),303);assert.equal(response.headers().location,'/setup');}
  assert.equal((await request.get(origin+'/missing',{maxRedirects:0})).status(),404);
  const out='.artifacts/first-run';await mkdir(out,{recursive:true});
  async function inspect(state) {
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'setup fits its viewport');
   const result=await new AxeBuilder({page}).analyze();assert.equal(result.violations.length,0,'setup accessibility');
   await page.screenshot({path:`${out}/${width}-${state}.png`,fullPage:true,mask:[page.locator('#setup-ingest-key'),page.getByLabel('SDK init',{exact:true}),page.getByLabel('Sentry DSN',{exact:true})]});
  }
  const name=page.getByLabel('Project name',{exact:true}),identifier=page.getByLabel('Project identifier',{exact:true}),submit=page.getByRole('button',{name:'Create project',exact:true});
  await identifier.waitFor();await submit.waitFor({state:'visible'});await page.waitForFunction(button=>button instanceof HTMLButtonElement&&!button.disabled,await submit.elementHandle());await inspect('pending');
  async function tabTo(control,label){await page.keyboard.press('Tab');assert.equal(await control.evaluate(el=>el===document.activeElement),true,label+' receives keyboard focus');}
  await page.getByRole('heading',{name:'Create your first project',exact:true}).focus();
  await tabTo(name,'Project name');await page.keyboard.type('   ');
  await tabTo(identifier,'Project identifier');await page.keyboard.type('journey');
  await tabTo(submit,'Create project button');
  const failure=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/projects'&&response.request().method()==='POST');await page.keyboard.press('Enter');assert.equal((await failure).status(),400);
  await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('alert').evaluate(el=>el===document.activeElement),true);await inspect('failed');
  assert.equal((await (await request.get(origin+'/api/projects')).json()).length,0);assert.equal((await request.get(origin+'/',{maxRedirects:0})).headers().location,'/setup');
  await identifier.fill('');await name.fill('Journey');assert.equal(await identifier.inputValue(),'journey','a cleared identifier follows the name');await tabTo(identifier,'Project identifier');await tabTo(submit,'Create project button');
  const success=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/projects'&&response.request().method()==='POST');await page.keyboard.press('Enter');assert.equal((await success).status(),201);
  const key=page.getByLabel('Ingest key',{exact:true});await key.waitFor();assert.equal((await key.inputValue()).length>0,true);
  const init=page.getByLabel('SDK init',{exact:true}),initText=await init.innerText();assert.equal(initText.includes(await key.inputValue())&&initText.includes(JSON.stringify(origin)),true,'first-run SDK init carries this installation and the new ingest key');
  const dsn=page.getByLabel('Sentry DSN',{exact:true});assert.equal((await dsn.innerText()).includes(await key.inputValue()),true,'first-run setup still shows the Sentry DSN for the new ingest key');
  assert.deepEqual(consoleErrors,[],'setup form patterns compile without console errors');
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  await page.getByRole('heading',{name:'Your project is ready',exact:true}).focus();
  const copy=page.getByRole('button',{name:'Copy ingest key',exact:true});
  await tabTo(key,'Ingest key');await tabTo(copy,'Copy ingest key button');await page.keyboard.press('Enter');
  const copyStatus=page.getByRole('status').filter({hasText:'Key copied.'});await copyStatus.waitFor();
  assert.equal(await copyStatus.evaluate(el=>typeof el.textContent==='string'&&el.textContent.trim().length>0),true,'keyboard copy gives feedback');
  assert.equal(await page.evaluate(async()=>await navigator.clipboard.readText()===document.querySelector('#setup-ingest-key').value),true,'copy retains the once-shown ingest key');await page.evaluate(()=>navigator.clipboard.writeText(''));
  assert.equal(new URL(page.url()).pathname,'/setup');assert.equal(new URL(page.url()).search,'');
  assert.equal(await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0),true,'first key stays out of browser storage');await inspect('key');
  assert.equal((await (await request.get(origin+'/api/projects')).json()).length,1);
  await tabTo(page.getByLabel('Release',{exact:true}),'Release');await tabTo(page.getByLabel('Build',{exact:true}),'Build');
  await tabTo(page.getByRole('button',{name:'Copy Install command',exact:true}),'Copy install command button');
  await tabTo(page.getByRole('button',{name:'Copy SDK init',exact:true}),'Copy SDK init button');await page.keyboard.press('Enter');await page.getByRole('status').filter({hasText:/^Copied\.$/}).waitFor();
  assert.equal(await page.evaluate(async()=>await navigator.clipboard.readText()),initText,'copy retains the SDK init with its key');await page.evaluate(()=>navigator.clipboard.writeText(''));
  // A dev-created ingest key works from the app once its exact origin is allowed.
  // The application never receives the private owner gate.
  const appOrigin='http://127.0.0.1:15599',ingestKey=await key.inputValue();
  const fromApp=()=>fetch(origin+'/api/ingest/journey',{method:'POST',headers:{Origin:appOrigin,Authorization:`Bearer ${ingestKey}`,'content-type':'application/json'},body:JSON.stringify({version:1,eventId:`app-${width}-${Date.now()}`,release:'1.0.0',build:'local',environment:'production',type:'TypeError',message:'From the app origin',frames:[{file:appOrigin+'/app.js',line:1,column:0,function:'checkout'}]})});
  assert.equal((await (await fromApp()).json()).reason,'origin_not_allowed','an origin that first run has not allowed is refused');
  await tabTo(page.getByRole('link',{name:'source-map setup',exact:true}),'Source-map setup link');
  await tabTo(page.getByLabel('Your app’s origin',{exact:true}),'App origin field');await page.keyboard.type(appOrigin);
  const allowed=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/projects/journey/browser-origins'&&response.request().method()==='POST');
  await tabTo(page.getByRole('button',{name:'Allow origin',exact:true}),'Allow origin button');await page.keyboard.press('Enter');assert.equal((await allowed).status(),201);
  assert.ok((await (await request.get(origin+'/api/projects/journey/browser-origins')).json()).some(row=>row.origin===appOrigin),'first run allowed the app origin');
  await tabTo(page.getByRole('link',{name:'Manage allowed origins',exact:true}),'Manage allowed origins link');
  await tabTo(page.getByRole('button',{name:'Send test error',exact:true}),'Send test error button');await page.keyboard.press('Enter');
  await page.getByRole('status').filter({hasText:'Test error received.'}).waitFor();
  const testIssue=page.getByRole('link',{name:'Open the test issue',exact:true});await tabTo(testIssue,'Open the test issue link');
  const issueId=decodeURIComponent((await testIssue.getAttribute('href')).split('/').at(-1));assert.ok((await (await request.get(origin+'/api/projects/journey/issues')).json()).some(row=>row.id===issueId),'the test error became an issue');
  const captured=await fromApp();assert.equal(captured.status,201,'the allowed app uses its scoped key without the owner gate');assert.equal((await captured.json()).outcome,'accepted');
  await tabTo(page.getByRole('button',{name:'Copy Sentry DSN',exact:true}),'Copy Sentry DSN button');await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(async()=>await navigator.clipboard.readText()),await dsn.innerText(),'copy retains the once-shown DSN');await page.evaluate(()=>navigator.clipboard.writeText(''));await inspect('sent');
  const continueLink=page.getByRole('link',{name:'Continue to workbench',exact:true});await tabTo(continueLink,'Continue to workbench link');await page.keyboard.press('Enter');await page.getByRole('navigation',{name:'Workbench',includeHidden:true}).getByRole('link',{name:'Settings',exact:true,includeHidden:true}).waitFor({state:'attached'});assert.equal(new URL(page.url()).pathname,'/projects/journey/issues');
  await page.reload();await page.getByRole('navigation',{name:'Workbench',includeHidden:true}).getByRole('link',{name:'Settings',exact:true,includeHidden:true}).waitFor({state:'attached'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`${out}/${width}-complete.png`,fullPage:true});
  const complete=await request.get(origin+'/setup',{maxRedirects:0});assert.equal(complete.status(),303);assert.equal(complete.headers().location,'/');
  assert.equal((await request.get(origin+'/missing')).status(),404);
  const cookies=await context.cookies();return cookies.map(cookie=>cookie.name+'='+cookie.value).join('; ');
 } finally {await context?.close();await plain.close();}
}
