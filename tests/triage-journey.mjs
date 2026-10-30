import { operatorUi } from './operator-ui.mjs';
import {archiveProjection} from './archive.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import {startTestWorker} from './worker.mjs';
import {assertSignInForm,signIn,testOwner,openGate} from './auth.mjs';
import {launchBrowser} from './browser-launch.mjs';
import {startDispatchApp} from './triage-app.mjs';
import {verifyReturnDestinations} from './triage-auth.mjs';
import {workbenchLink,openSection,settingsSection} from './navigation.mjs';
const output='.artifacts/triage-review';await mkdir(output,{recursive:true});
const evidence={candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),business:'Cedar Dispatch',caption:'Synthetic business; real local capture and owner actions.',captures:[],checks:[]};
async function journey(width) {
 const worker=await startTestWorker(15482),origin=worker.origin;let browser,application;
 const checked=name=>evidence.checks.push({width,name});
try {
 const cookie=await signIn(origin);
 async function api(path,method='GET',value){const response=await fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,...value?{'Content-Type':'application/json'}:{}},...value?{body:JSON.stringify(value)}:{}});assert.ok(response.ok,`${method} ${path}: ${response.status}`);return path==='/api/archive'?archiveProjection(response):response.json();}
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width,height:900},permissions:['clipboard-read','clipboard-write']});
 await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:origin}]);
 const page=await context.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));page.setDefaultTimeout(15000);
 async function capture(scenario,width){
  await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${scenario} overflow`);
  const grouping=scenario.startsWith('grouping-'),rule=scenario.startsWith('grouping-rule-');
  if(grouping){const target=rule?page.getByRole('heading',{name:'Project grouping rules',exact:true}):page.locator('article[aria-label="Grouping proposal review"] h3').first();if(await target.isVisible())await target.evaluate(element=>element.scrollIntoView({block:'start'}));else{const empty=page.getByRole('heading',{name:'Agent grouping proposals',exact:true});if(await empty.isVisible())await empty.evaluate(element=>element.scrollIntoView({block:'start'}));}}
  const shot=async name=>{const path=`${name}-${width}.jpg`;await page.screenshot({path:output+'/'+path,type:'jpeg',quality:85,fullPage:!grouping&&!scenario.startsWith('operator-'),mask:[page.locator('.secret-key, input[type="password"], [data-secret]')]});evidence.captures.push({scenario:name,width,path});};
  await shot(scenario);
  if(scenario==='grouping-proposal-proposed'||scenario==='grouping-proposal-approved'){const headings=page.locator('article[aria-label="Grouping proposal review"] .grouping-explanation h4');for(let index=0;index<await headings.count();index++){await headings.nth(index).evaluate(element=>element.scrollIntoView({block:'start'}));await shot(`${scenario}-effect-${index+1}`);}
   const action=scenario==='grouping-proposal-approved'?page.getByRole('heading',{name:'Review exact moves',exact:true}):page.getByRole('button',{name:'Approve proposal and open preview',exact:true});await action.evaluate(element=>element.scrollIntoView({block:'start'}));await shot(`${scenario}-decision`);}
 }

 {
  const visitor=await browser.newContext({viewport:{width,height:900}}),lobby=await visitor.newPage();
  lobby.on('pageerror',error=>pageErrors.push(error.message));await lobby.goto(origin+'/');
  assert.equal(await lobby.locator('html').getAttribute('data-state'),'unclaimed');
  assert.equal(await lobby.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Lobby overflow');
  assert.deepEqual((await new AxeBuilder({page:lobby}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(item=>item.id),[]);
  const setup=lobby.getByRole('link',{name:'Finish setup',exact:true});assert.equal(await setup.getAttribute('href'),'/setup');
  await setup.click();await assertSignInForm(lobby,'/setup');
  await visitor.close();checked('Visitor unclaimed Lobby fits, passes axe and Finish setup leads to owner sign-in preserving /setup');
 }
 const project=await api('/api/projects','POST',{id:'cedar',name:'Cedar Dispatch'});
 await page.goto(origin+'/projects/cedar/issues');await page.getByRole('heading',{name:'Waiting for your first event',exact:true}).waitFor();
 if(width===390)await page.getByRole('button',{name:/^Menu/}).click();
 await capture('owner-name',width);
 assert.equal(await page.locator('.team p').innerText(),'Test owner');
 if(width===390)await page.getByRole('button',{name:/^Menu/}).click();
 await capture('waiting',width);
 await page.getByRole('button',{name:'Set up capture',exact:true}).click();assert.equal(await page.locator('.right').count(),0);
 await page.getByRole('button',{name:'Register your first release',exact:true}).click();
 await page.getByLabel('Release name',{exact:true}).fill('autumn-deliveries');await page.getByLabel('Build identifier',{exact:true}).fill('dispatch-a');
 await page.getByRole('button',{name:'Register release',exact:true}).click();await page.locator('.data-row strong').filter({hasText:'autumn-deliveries'}).waitFor();
 await (await workbenchLink(page,'Capture')).click();
 const snippet=await page.getByLabel('SDK init',{exact:true}).innerText();assert.ok(snippet.includes(JSON.stringify(origin)));assert.ok(!snippet.includes('location.origin'));
 application=await startDispatchApp({endpoint:origin,project:'cedar',ingestKey:project.ingestKey,release:'autumn-deliveries',build:'dispatch-a',environment:'production',debugId:'dispatch-map'});
 await page.getByLabel('Exact application origin',{exact:true}).fill(application.origin);await page.getByRole('button',{name:'Allow browser origin',exact:true}).click();await page.getByRole('status').filter({hasText:'Allowed'}).waitFor();
 const appPage=await context.newPage();async function throwInApp(){await appPage.goto(application.origin);await appPage.getByRole('button',{name:'Prepare delivery'}).click();await appPage.waitForFunction(()=>window.captureOutcome?.outcome==='accepted');return appPage.evaluate(()=>window.captureOutcome);}
 const admitted=await throwInApp();assert.ok(admitted.issue);checked('Real minified application throws and capture crosses a second loopback origin');
 const issuePath='/projects/cedar/issues/'+admitted.issue;
 await (await workbenchLink(page,'Issues',false)).click();await page.locator('.unseen-label').waitFor();
 const row=page.locator('tbody tr').first();assert.match(await row.innerText(),/New/);await row.getByRole('link').click();await page.locator('.missing-map').waitFor();assert.equal(await page.locator('.missing-map').count(),1);
 await page.getByRole('button',{name:'Upload map',exact:true}).click();await page.getByLabel('Bundle debug ID',{exact:true}).waitFor();assert.equal(await page.getByLabel('Bundle debug ID',{exact:true}).inputValue(),'dispatch-map');
 await page.getByLabel('Source map file · max 256 KiB',{exact:true}).setInputFiles({name:'dispatch.js.map',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(application.map))});
 await page.getByRole('button',{name:'Upload matching map',exact:true}).click();await page.getByRole('status').filter({hasText:'Source map uploaded'}).waitFor();
 await capture('map-upload',width);
 await page.getByRole('button',{name:'Return to issue',exact:true}).click();await page.locator('.mapped-frame').first().waitFor();
 const packet=await api('/api/projects/cedar/issues/'+admitted.issue+'/packet');assert.equal(packet.events[0].currentLookup[0].original.line,application.originalLine);const coordinate=packet.events[0].currentLookup[0].original;
 assert.equal(await page.locator('.frame-coordinate').first().innerText(),`${coordinate.file}:${coordinate.line}:${coordinate.column}`);
 assert.equal(await page.locator('.missing-map').count(),0);checked('Contextual map upload yields actual original path, line and column as first stack fact');
 {await capture('mapped-issue',width);const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(item=>item.id),[]);}
 await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Copy link',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),origin+issuePath);
 await page.reload();await page.locator('.mapped-frame').first().waitFor();assert.equal(new URL(page.url()).pathname,issuePath);
 await page.getByRole('link',{name:'All issues',exact:true}).click();await page.goBack();await page.locator('.mapped-frame').first().waitFor();await page.goForward();await page.getByRole('heading',{name:'Issues',exact:true}).last().waitFor();await page.waitForLoadState('networkidle');assert.equal(await page.locator('.unseen-label').count(),0);
 await page.goto(origin+issuePath);const details=page.getByRole('button',{name:'Details: Issue and source evidence',exact:true});await details.click();await page.getByRole('dialog').waitFor();assert.ok(await page.getByRole('dialog').evaluate(dialog=>dialog.contains(document.activeElement)));await page.keyboard.press('Shift+Tab');assert.ok(await page.getByRole('dialog').evaluate(dialog=>dialog.contains(document.activeElement)));await page.keyboard.press('Escape');assert.equal(await details.evaluate(button=>document.activeElement===button),true);checked('Copy destination, refresh, history, viewed count and Details focus/Escape');
 await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('resolved');await page.waitForFunction(()=>document.querySelector('.state-chip')?.textContent==='Resolved');
 await api('/api/projects/cedar/releases','POST',{name:'winter-deliveries',build:'dispatch-b'});await api('/api/projects/cedar/artifacts','POST',{release:'winter-deliveries',build:'dispatch-b',debugId:'dispatch-map',map:application.map});application.setRelease('winter-deliveries','dispatch-b');const regressed=await throwInApp();assert.equal(regressed.issue,admitted.issue);
 application.setRelease('autumn-deliveries','dispatch-a');assert.equal((await throwInApp()).issue,admitted.issue);
 await appPage.evaluate(()=>{window.captureOutcome=null;});await appPage.getByRole('button',{name:'Track delivery'}).click();await appPage.waitForFunction(()=>window.captureOutcome?.outcome==='accepted');assert.notEqual((await appPage.evaluate(()=>window.captureOutcome)).issue,admitted.issue);
 await page.getByRole('link',{name:'All issues',exact:true}).click();await page.getByText('Regressed in winter-deliveries',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.unseen-label').length===2);assert.equal(await page.locator('.unseen-label').count(),2);assert.ok((await page.locator('tbody tr').first().innerText()).includes('Regressed in winter-deliveries'));
 await capture('regression-priority',width);
 await page.locator('tbody tr').first().getByRole('link').click();await page.getByText('Regressed in winter-deliveries',{exact:true}).waitFor();checked('Resolved issue recurs in next release; late older release does not replace regression identity');
 // Check drafts across destinations without relying on browser refresh persistence.
 await (await workbenchLink(page,'Releases')).click();await openSection(page,'Register a release');await page.getByLabel('Release name',{exact:true}).fill('spring-deliveries');await (await workbenchLink(page,'Capture')).click();await (await workbenchLink(page,'Releases')).click();await openSection(page,'Register a release');assert.equal(await page.getByLabel('Release name',{exact:true}).inputValue(),'spring-deliveries');

 // Settings has one path per section: /settings opens the first section this role sees, the section list moves
 // between paths (one control at phone width), a reload keeps the section and an unknown section is a real 404.
 await page.goto(origin+'/projects/cedar/settings');await page.waitForURL(url=>url.pathname==='/projects/cedar/settings/keys-and-capture');await page.getByRole('heading',{name:'Project keys',exact:true}).waitFor();
 await settingsSection(page,'Grouping');await page.waitForURL(url=>url.pathname==='/projects/cedar/settings/grouping');await page.getByRole('heading',{name:'Project grouping rules',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Project keys',exact:true}).count(),0);assert.ok((await page.title()).startsWith('Grouping · Settings ·'));
 await page.reload();await page.getByRole('heading',{name:'Project grouping rules',exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'Settings sections'}).getByRole('link',{name:'Grouping',exact:true,includeHidden:true}).getAttribute('aria-current'),'page');
 assert.equal((await page.goto(origin+'/projects/cedar/settings/no-such-section')).status(),404);checked('Settings opens one section per path, moves by its section list and refuses an unknown section');
 await verifyReturnDestinations(origin,issuePath,cookie);
 const expiredCookie=await signIn(origin,{bootstrap:false});const expired=await browser.newContext({viewport:{width,height:900}}),expiredPage=await expired.newPage();await expired.addCookies([{name:expiredCookie.split('=')[0],value:expiredCookie.slice(expiredCookie.indexOf('=')+1),url:origin}]);await expiredPage.goto(origin+issuePath);await expiredPage.locator('.issue').waitFor();await expiredPage.waitForLoadState('networkidle');await expiredPage.evaluate(()=>fetch('/auth/signout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));await expiredPage.waitForResponse(response=>response.url().endsWith('/packet'),{timeout:30000});await expiredPage.getByRole('link',{name:'Sign in again'}).waitFor();assert.ok((await expiredPage.getByRole('link',{name:'Sign in again'}).getAttribute('href')).includes(encodeURIComponent(issuePath)));await expired.close();checked('Hostile return destinations rejected and expired API session keeps requested issue');
 {const missingResponse=await page.goto(origin+'/unknown/page');assert.equal(missingResponse.status(),404);await page.getByRole('heading',{name:'This page is unavailable',exact:true}).waitFor();await capture('not-found',width);await page.getByRole('link',{name:'Back to issues',exact:true}).click();}
 assert.equal(pageErrors.length===0,true,'Owner-page errors occurred (details redacted)');checked('Styled direct-navigation 404, both widths, no owner-page errors or horizontal overflow');
 await operatorUi({page,api,origin,project:'cedar',issue:admitted.issue,capture:scenario=>capture(scenario,width)});assert.equal(pageErrors.length,0,'No owner-page errors after operator flows');checked('Operator assignment, policy toggle and reviewed correction plus undo use the rendered controls');
}finally{await browser?.close();await application?.stop();await worker.stop();}
}
for(const width of [1440,390])await journey(width);
await writeFile(output+'/manifest.json',JSON.stringify(evidence,null,2));console.log(`Triage public journey passed: ${evidence.checks.length} groups; ${evidence.captures.length} JPG captures at 1440 and 390.`);
