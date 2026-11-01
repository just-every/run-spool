import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {launchBrowser} from './browser-launch.mjs';
import {startDispatchApp} from './triage-app.mjs';
import {workbenchLink} from './navigation.mjs';

const organization='/api/organization';
const invitationIdentity=['synthetic-spool-6','example.test'].join('@');

export async function browserMembers(owner,projects) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const split=owner.cookie.indexOf('=');
  await context.addCookies([{name:owner.cookie.slice(0,split),value:owner.cookie.slice(split+1),url:owner.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();
  await page.goto(owner.origin+'/projects/'+projects[0].id+'/settings');
  const members=page.getByRole('region',{name:'Members',exact:true});
  await members.getByRole('heading',{name:'Members',exact:true}).waitFor();
  await members.locator('summary').filter({hasText:/^Invite a member$/}).click();
  const form=members.locator('form').filter({has:page.getByLabel('Email',{exact:true})});
  await form.getByLabel('Email',{exact:true}).fill(invitationIdentity);
  await form.getByLabel('Name',{exact:true}).fill('synthetic-spool-6');
  await form.getByLabel(/^Organization role/).selectOption('read-only');
  await form.getByLabel(new RegExp('^'+projects[0].name)).selectOption('read-only');
  const invited=page.waitForResponse(r=>new URL(r.url()).pathname===organization+'/invites'&&r.request().method()==='POST'&&r.status()===202);
  await form.getByRole('button',{name:'Send invitation',exact:true}).click();await invited;
  await members.getByText('synthetic-spool-6',{exact:true}).first().waitFor();
  // Stored grants contain member and created metadata; writes must send only the input shape.
  await members.getByRole('button',{name:'Details: synthetic-spool-6 access',exact:true}).click();
  const dialog=page.getByRole('dialog'),role=dialog.getByLabel(/^Organization role/),secondProject=dialog.getByLabel(new RegExp('^'+projects[1].name));
  async function saved(select,value) {
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname.startsWith(organization+'/members/')&&r.request().method()==='PUT');
   await select.selectOption(value);const response=await pending;
   assert.equal(response.status(),200,'the real Members request saves');
   for(const grant of response.request().postDataJSON().grants)assert.deepEqual(Object.keys(grant).sort(),['project','role']);
   await expect(select).toHaveValue(value);
   await expect(select).toBeEnabled();
  }
  await saved(role,'member');
  await saved(secondProject,'maintainer');
  // A real intervening update makes this dialog stale: no mocked failure door.
  const data=await owner.json(organization),member=data.members.find(row=>row.email===invitationIdentity);
  const grants=data.grants.filter(row=>row.member===member.id).map(({project,role})=>({project,role}));
  await owner.json(organization+'/members/'+member.id,'PUT',{version:member.version,role:member.role,grants});
  for(const [select,value,stored] of [[role,'read-only','member'],[secondProject,'read-only','maintainer']]) {
   const pending=page.waitForResponse(r=>new URL(r.url()).pathname===organization+'/members/'+member.id&&r.request().method()==='PUT');
   await select.selectOption(value);assert.equal((await pending).status(),409,'stale save is refused by server validation');
   await expect(select).toHaveValue(stored,'a refused save restores the stored selection');
   await expect(select).toBeEnabled();
  }
  await dialog.getByRole('button',{name:'Close details',exact:true}).click();
  await members.locator('summary').filter({hasText:/^Service accounts$/}).click();
  const services=members.locator('form').filter({has:page.getByLabel('Service account name',{exact:true})});
  await services.getByLabel('Service account name',{exact:true}).fill('synthetic-spool-ui-service');
  await services.getByRole('group',{name:projects[0].name,exact:true}).getByRole('checkbox',{name:'Agent',exact:true}).check();
  const created=page.waitForResponse(r=>new URL(r.url()).pathname===organization+'/services'&&r.request().method()==='POST'&&r.status()===201);
  await services.getByRole('button',{name:'Create service account',exact:true}).click();await created;
  await members.getByText('synthetic-spool-ui-service',{exact:true}).waitFor();
  await members.getByText('Sponsored by Test owner',{exact:true}).waitFor();
  assert.equal(await members.locator('input,select,button,label,p,summary').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)),true);
  const violations=(await new AxeBuilder({page}).include('[aria-label="Members"]').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact));
  assert.deepEqual(violations,[],'Members settings has no serious accessibility violation');
  const folder=process.env.SPOOL_TEAM_EVIDENCE || '.artifacts/team';
  await mkdir(folder,{recursive:true});await members.screenshot({path:resolve(folder,'members-1440.png')});
  await page.setViewportSize({width:390,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Members settings fits the phone viewport');
  await members.screenshot({path:resolve(folder,'members-390.png')});
  await context.close();
 }finally{await browser.close()}
}

export async function memberBrowser(actor,project,issue) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const split=actor.cookie.indexOf('=');
  await context.addCookies([{name:actor.cookie.slice(0,split),value:actor.cookie.slice(split+1),url:actor.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();
  const path='/projects/'+project.id+'/issues/'+issue.id;
  await page.goto(actor.origin+path);
  await expect(page.getByRole('main')).toContainText(issue.title);
  await page.waitForLoadState('networkidle');
  const destination=new URL(page.url()).pathname+new URL(page.url()).search;
  return {
   async removed() {
    // The next ordinary read must clear an already open private screen immediately.
    const denied=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/packet')&&response.status()===401);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await denied;
    await expect(page.getByRole('heading',{name:'Session ended',exact:true})).toBeVisible();
    const signIn=page.getByRole('link',{name:'Sign in again',exact:true});
    await expect(signIn).toHaveAttribute('href','/sign-in?returnTo='+encodeURIComponent(destination));
    assert.equal(new URL(page.url()).pathname,path,'revocation preserves the private destination without navigating');
    await expect(page.getByRole('main')).not.toContainText(issue.title);
    assert.equal(await page.locator('.issue,.evidence,.secret-key').count(),0,'revocation removes every private evidence panel');
    const folder=process.env.SPOOL_TEAM_EVIDENCE || '.artifacts/team';
    await mkdir(folder,{recursive:true});
    await page.screenshot({path:resolve(folder,'removed-1440.png')});
    await page.setViewportSize({width:390,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'the removed member sign-in fits the phone viewport');
    await page.screenshot({path:resolve(folder,'removed-390.png')});
    await signIn.click();await expect(page).toHaveURL(url=>url.pathname==='/sign-in'&&url.searchParams.get('returnTo')===destination);
    await page.goto(actor.origin+destination);await expect(page).toHaveURL(url=>url.pathname==='/sign-in'&&url.searchParams.get('returnTo')===destination);
   },
   close:()=>browser.close(),
  };
 }catch(error){await browser.close();throw error}
}

/** UX-001: one native team shares a real captured failure through its entire triage path. */
export async function teamTriage(owner,member,project) {
 const browser=await launchBrowser();let application;
 const root='/api/projects/'+project.id,origin=owner.origin;
 const folder=process.env.SPOOL_TEAM_EVIDENCE||'.artifacts/team';await mkdir(folder,{recursive:true});
 try {
  await owner.json(root+'/releases','POST',{name:'synthetic-spool-ux',build:'web'});
  application=await startDispatchApp({endpoint:origin,project:project.id,ingestKey:project.ingestKey,release:'synthetic-spool-ux',build:'web',environment:'production',debugId:'synthetic-spool-ux'});
  await owner.json(root+'/browser-origins','POST',{origin:application.origin});
  const capturePage=await browser.newPage();await capturePage.goto(application.origin);await capturePage.getByRole('button',{name:'Prepare delivery',exact:true}).click();await capturePage.waitForFunction(()=>window.captureOutcome?.outcome==='accepted');
  const issue=(await capturePage.evaluate(()=>window.captureOutcome)).issue;assert.ok(issue);await capturePage.close();
  await owner.json(root+'/artifacts','POST',{release:'synthetic-spool-ux',build:'web',debugId:'synthetic-spool-ux',map:application.map});
  const packet=await owner.json(root+'/issues/'+issue+'/packet');assert.equal(packet.events[0].currentLookup[0].original.line,application.originalLine);
  async function contextFor(cookie) {const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true});const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);return context;}
  const memberContext=await contextFor(member.cookie),ownerContext=await contextFor(owner.cookie);
  const memberPage=await memberContext.newPage(),ownerPage=await ownerContext.newPage(),path='/projects/'+project.id+'/issues/'+issue;
  const errors=[];for(const page of [memberPage,ownerPage])page.on('pageerror',error=>errors.push(error.message));
  async function screens(page,name) {for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,name+' reflow');if(name==='team-repair-approved')await page.locator('.repairs').scrollIntoViewIfNeeded();else await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(folder,name+'-'+width+'.png'),fullPage:false});}await page.setViewportSize({width:1440,height:900});}
  await memberPage.goto(origin+'/projects/'+project.id+'/issues');await memberPage.getByLabel('Search issues',{exact:true}).fill('release:synthetic-spool-ux');
  const match=memberPage.locator('tbody tr').filter({has:memberPage.locator('a[href="'+path+'"]')});await expect(match).toHaveCount(1);await match.getByRole('link').click();
  await expect(memberPage.locator('.frame-coordinate').first()).toContainText(packet.events[0].currentLookup[0].original.file);
  await memberPage.getByLabel('Assigned to',{exact:true}).fill('Cedar responder');
  let releaseAssignment;const gate=new Promise(resolve=>{releaseAssignment=resolve});let assignments=0;
  await memberPage.route('**/assignment',async route=>{if(route.request().method()==='PATCH'){assignments++;await gate;}await route.continue();});
  const saved=memberPage.waitForResponse(response=>response.url().endsWith('/assignment')&&response.request().method()==='PATCH');
  const save=memberPage.getByRole('button',{name:'Save assignment',exact:true});await save.click();await expect(save).toBeDisabled();
  assert.equal(await save.evaluate(button=>button.disabled),true,'a pending assignment refuses a duplicate activation');await save.evaluate(button=>button.click());releaseAssignment();assert.equal((await saved).status(),200);
  await memberPage.unroute('**/assignment');await expect(save).toBeEnabled();assert.equal(assignments,1);
  assert.equal((await owner.json(root+'/operator-state')).assignments.find(row=>row.issue===issue).label,'Cedar responder');
  const body='synthetic-spool-1 investigating the mapped delivery failure';await memberPage.getByLabel('Comment',{exact:true}).fill(body);await memberPage.getByRole('button',{name:'Post comment',exact:true}).click();
  await expect(memberPage.getByRole('region',{name:'Discussion',exact:true})).toContainText(body);assert.ok((await owner.json(root+'/issues/'+issue+'/discussion')).comments.some(row=>row.body===body&&row.author===member.member.name));
  assert.deepEqual((await new AxeBuilder({page:memberPage}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(item=>item.id),[]);
  await screens(memberPage,'team-investigation');await (await workbenchLink(memberPage,'Alerts')).click();
  const alert=memberPage.locator('.alert-records li').filter({hasText:packet.issue.title}).first();await alert.waitFor();await screens(memberPage,'team-alert');
  await memberPage.setViewportSize({width:390,height:900});await alert.getByRole('button',{name:'Open issue',exact:true}).tap();await memberPage.setViewportSize({width:1440,height:900});
  await memberPage.locator('.mapped-frame').first().waitFor();assert.equal(new URL(memberPage.url()).pathname,path,'the touched alert opens the same mapped issue');
  await ownerPage.goto(origin+path);await ownerPage.getByLabel('Branch or pull request link (https)',{exact:true}).fill('https://code.example.test/cedar/repair');await ownerPage.getByLabel('Note',{exact:true}).fill('synthetic-spool-1 reviewed with Cedar responder');
  await ownerPage.getByRole('button',{name:'Record repair',exact:true}).click();const record=ownerPage.locator('article.repair').filter({has:ownerPage.getByRole('link',{name:'https://code.example.test/cedar/repair',exact:true})});
  await record.getByRole('button',{name:'Mark approved',exact:true}).click();await expect(record.getByRole('button',{name:'Mark approved',exact:true})).toHaveCount(0);
  assert.ok((await owner.json(root+'/repairs?issue='+issue)).repairs.find(row=>row.link==='https://code.example.test/cedar/repair').facts.approved,'the approval is recorded, not merely displayed');
  await screens(ownerPage,'team-repair-approved');
  const missing=await memberPage.goto(origin+'/projects/synthetic-spool-unavailable/issues');assert.equal(missing.status(),404);await expect(memberPage.getByRole('heading',{name:'This project is unavailable',exact:true})).toBeVisible();
  await expect(memberPage.getByRole('main')).toContainText('access');await expect(memberPage.getByRole('main')).not.toContainText(packet.issue.title);await screens(memberPage,'team-permission');
  assert.deepEqual(errors,[],'the team path has no browser errors');
  console.log('[UX-001] native team onboarded, actual browser error captured and mapped, searched, assigned without duplicate writes, commented, alert followed by touch and repair approval recorded; 1440 and 390 screens');
 }finally{await browser.close();await application?.stop();}
}
