import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';

export async function ownerSetupBrowser(app, cookie, project, json) {
 const browser=await launchBrowser(),folder='.artifacts/owner-setup';
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:app.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await mkdir(folder,{recursive:true});
  const screenshot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'owner setup reflows');await page.screenshot({path:`${folder}/${name}-${width}.png`,fullPage:true,mask:[page.locator('[data-secret] pre'),page.getByLabel('Project ingest key',{exact:true}),page.getByLabel('SDK init',{exact:true}),page.getByLabel('Browser helper init',{exact:true}),page.getByLabel('Sentry DSN',{exact:true})]});}await page.setViewportSize({width:1440,height:1000});};
  await page.goto(app.origin+'/projects/'+project.id+'/settings#settings-organization');
  const members=page.getByRole('region',{name:'Members',exact:true});
  const form=members.locator('form').filter({has:page.getByLabel('Email',{exact:true})});
  for(const [role,name,email] of [['owner','Imported owner','synthetic-spool-owner@example.test'],['manager','Imported manager','synthetic-spool-manager@example.test']]){
   await form.getByLabel('Email',{exact:true}).fill(email);await form.getByLabel('Name',{exact:true}).fill(name);
   await form.getByLabel(/^Organization role/).selectOption(role);
   await form.getByLabel(new RegExp('^'+project.name)).selectOption('maintainer');
   const invite=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/organization/invites'&&r.request().method()==='POST');
   await form.getByRole('button',{name:'Send invitation',exact:true}).click();assert.equal((await invite).status(),202);
   await expect(members.getByText(name,{exact:true}).first()).toBeVisible();
  }
  await screenshot('import-roles');
  await members.locator('summary').filter({hasText:/^Team members$/}).click();
  await members.getByRole('button',{name:'Details: Platform members',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Platform members',exact:true});
  await expect(dialog).toContainText('Imported owner');await expect(dialog).toContainText('Imported manager');await expect(dialog).toContainText('Invitation pending');
  await expect(dialog).not.toContainText('synthetic-spool-outsider@example.test');await screenshot('team-members');
  await page.keyboard.press('Escape');
  await page.goto(app.origin+'/projects/'+project.id+'/settings#settings-projects');await page.getByRole('link',{name:'Create, copy and test an ingest key',exact:true}).waitFor();await screenshot('settings-keys');
  const firstIssued=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/projects/'+project.id+'/keys'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create ingest key',exact:true}).click();assert.equal((await firstIssued).status(),201);
  const firstKey=await page.locator('[data-secret="project-key"] pre').innerText(),firstDsn=await page.getByLabel('Sentry DSN',{exact:true}).innerText();await page.getByRole('button',{name:'Copy Project key',exact:true}).click();
  assert.equal(await page.evaluate(async key=>(await navigator.clipboard.readText())===key,firstKey),true);await page.evaluate(()=>navigator.clipboard.writeText(''));await screenshot('settings-issued');
  await page.getByRole('link',{name:'open Capture to copy and test this key',exact:true}).click();
  assert.equal((await page.getByLabel('Ingest key',{exact:true}).innerText())===firstKey,true,'navigation retains the same issued key in memory');
  assert.equal(await page.getByLabel('Sentry DSN',{exact:true}).innerText(),firstDsn,'navigation carries the matching DSN with the key');
  const support=page.getByRole('list',{name:'Sentry capture support',exact:true});
  await expect(support).toBeVisible();
  const dsn=new URL(firstDsn),stamp=new Date().toISOString();
  const session=await context.request.post(app.origin+'/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+dsn.username,{headers:{'Content-Type':'text/plain'},data:'{}\n'+JSON.stringify({type:'session'})+'\n'+JSON.stringify({sid:crypto.randomUUID().replaceAll('-',''),init:true,started:stamp,timestamp:stamp,status:'exited',errors:0,attrs:{release:'synthetic-spool-session',environment:'production'}})});
  assert.equal(session.status(),200,'The advertised session category accepts real intake');
  const health=await json('/api/projects/'+project.id+'/release-health');assert.equal(health.denominators.sessionsSeen,1,'Session intake becomes observed release health');
  const releasePage=await context.newPage();try{await releasePage.goto(app.origin+'/projects/'+project.id+'/releases');await expect(releasePage.getByRole('region',{name:'Release health',exact:true})).toContainText('synthetic-spool-session');}finally{await releasePage.close();}
  const prerequisites=page.getByRole('link',{name:'Node.js prerequisite setup steps',exact:true});
  const guide=await context.request.get(app.origin+await prerequisites.getAttribute('href'));assert.equal(guide.status(),200);
  const fragment=new URL(await prerequisites.getAttribute('href'),app.origin).hash.slice(1);
  assert.ok(fragment&&await page.evaluate(({html,fragment})=>!!new DOMParser().parseFromString(html,'text/html').getElementById(fragment),{html:await guide.text(),fragment}),'the prerequisite link reaches its actual guide section');
  const mapping=page.getByRole('heading',{name:'Set up original-source mapping',exact:true}).locator('..');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await mapping.screenshot({path:`${folder}/source-map-setup-${width}.png`});}await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'Dismiss ingest key',exact:true}).click();
  await page.getByRole('button',{name:'Create ingest key',exact:true}).waitFor();await screenshot('capture-reissue');
  const created=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/projects/'+project.id+'/keys'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create ingest key',exact:true}).click();const issued=await created;assert.equal(issued.status(),201);const grant=await issued.json();
  const copy=page.getByRole('button',{name:'Copy Ingest key',exact:true});await copy.click();
  assert.equal(await page.evaluate(async key=>(await navigator.clipboard.readText())===key,grant.key),true,'owner copies the usable native ingest key');await page.evaluate(()=>navigator.clipboard.writeText(''));
  assert.ok((await page.getByLabel('SDK init',{exact:true}).innerText()).includes(grant.key));
  await page.getByRole('button',{name:'Send test error',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Test error received.'})).toBeVisible();
  const issues=await json('/api/projects/'+project.id+'/issues');assert.ok(issues.some(row=>row.title.includes('SpoolTestError')),'normal setup sends a real received event');
  assert.ok(!JSON.stringify(await json('/api/audit')).includes(grant.key),'audit never contains the credential');
  assert.ok(!page.url().includes(grant.key),'no key in navigation URLs');
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage})).then(text=>text.includes(grant.key)),false);
  await expect(page.getByRole('heading',{name:'Capture is receiving events',exact:true})).toBeVisible();await screenshot('capture-received');
  await page.getByRole('link',{name:'Open the test issue',exact:true}).click();await expect(page.getByRole('heading',{name:/SpoolTestError/})).toBeVisible();
  await page.goto(app.origin+'/projects/'+project.id+'/capture');await page.reload();await expect(page.getByRole('button',{name:'Create ingest key',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copy Ingest key',exact:true})).toHaveCount(0);
  assert.deepEqual(errors,[]);return grant;
 }finally{await browser.close();}
}

// A project member retains deployment writes without receiving alert contacts.
export async function deploymentMemberBrowser(app,cookie,project,json) {
 const base='/api/projects/'+project.id,sha='a'.repeat(40),folder='.artifacts/owner-setup';
 const destination=await json(base+'/alerting/destinations','POST',{label:'Private release contact',recipient:'synthetic-spool-private-release@example.test'});
 const otherDestination=await json(base+'/alerting/destinations','POST',{label:'Another private release contact',recipient:'synthetic-spool-other-release@example.test'});
 const memberChoices=await json(base+'/alerting/deployment-options','GET',undefined,cookie);
 const routeNames=memberChoices.rows.filter(row=>[destination.id,otherDestination.id].includes(row.id));
 assert.equal(new Set(routeNames.map(row=>row.label)).size,2,'member can distinguish two stable deadline routes');
 assert.ok(routeNames.every(row=>!row.label.includes('@')&&!row.label.includes('Private')),'routing aliases reveal no contact');
 await json(base+'/releases','POST',{name:'member-proof',build:'web-1'});
 await json(base+'/deployments','POST',{id:'synthetic-spool-existing',release:'member-proof',build:'web-1',environment:'production',repository:'https://example.test/cedar/checkout',commitSha:sha,includedCommits:[sha],startedAt:new Date().toISOString(),deadline:new Date(Date.now()+3600000).toISOString(),destination:destination.id});
 const browser=await launchBrowser();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC'}),split=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:app.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage(),errors=[],contactReads=[];page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().endsWith('/alerting/destinations'))contactReads.push(request.url())});
  await page.goto(app.origin+'/projects/'+project.id+'/releases');const panel=page.locator('#deployment-history');
  await page.waitForFunction(()=>{const panel=document.querySelector('#deployment-history');return panel&&(panel.querySelector('.deployment-record')||panel.querySelector('[role=alert]'))});
  await mkdir(folder,{recursive:true});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await panel.screenshot({path:`${folder}/member-deployments-${width}.png`});}
  assert.equal(await panel.locator('.deployment-record').count(),1,'member can inspect existing deployment history');
  assert.deepEqual(contactReads,[],'deployment tracking does not request the contact directory');
  await expect(panel).not.toContainText('Private release contact');await expect(panel).not.toContainText('synthetic-spool-private-release@example.test');
  await page.goto(app.origin+'/projects/'+project.id+'/capture');
  await expect(page.locator('main')).toContainText(/maintainer.*administrator.*owner/i);
  await expect(page.locator('main')).toContainText(/Settings.*Projects & keys/i);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${folder}/member-capture-${width}.png`,fullPage:true,mask:[page.getByLabel('Project ingest key',{exact:true})]});}await page.setViewportSize({width:1440,height:1000});
  await page.goto(app.origin+'/projects/'+project.id+'/releases');await panel.getByLabel('Deadline email destination',{exact:true}).waitFor();
  for(const row of routeNames)await expect(panel.getByLabel('Deadline email destination',{exact:true}).locator(`option[value="${row.id}"]`)).toHaveText(row.label);
  await panel.getByLabel('Deployment ID',{exact:true}).fill('synthetic-spool-member');await panel.getByLabel('Deployment release',{exact:true}).selectOption('member-proof');
  await panel.getByLabel('Repository HTTPS URL',{exact:true}).fill('https://example.test/cedar/checkout');await panel.getByLabel('Deployment commit SHA',{exact:true}).fill(sha);await panel.getByLabel('Included commit SHAs, oldest first',{exact:true}).fill(sha);
  await panel.getByLabel('Owner deadline',{exact:true}).fill(new Date(Date.now()+3600000).toISOString().slice(0,16));await panel.getByLabel('Deadline email destination',{exact:true}).selectOption(destination.id);
  await panel.getByRole('button',{name:'Start deployment',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Deployment started.');
  await panel.getByLabel('Deployment to update',{exact:true}).selectOption('synthetic-spool-member');await panel.getByLabel('Deployment outcome',{exact:true}).selectOption('succeeded');await panel.getByLabel('Exposure percent',{exact:true}).fill('100');
  await panel.getByRole('button',{name:'Record deployment outcome',exact:true}).click();await expect(panel.getByRole('status')).toHaveText('Deployment outcome recorded.');
  const history=await json(base+'/deployments');assert.equal(history.rows.find(row=>row.id==='synthetic-spool-member').steps.at(-1).state,'succeeded');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.screenshot({path:`${folder}/member-outcome-${width}.png`});}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
