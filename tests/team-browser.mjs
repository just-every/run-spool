import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {launchBrowser} from './browser-launch.mjs';

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
  return {
   async removed() {
    await page.reload();
    await expect(page).toHaveURL(url=>url.pathname==='/sign-in');
    await expect(page.getByRole('main')).not.toContainText(issue.title);
    const folder=process.env.SPOOL_TEAM_EVIDENCE || '.artifacts/team';
    await mkdir(folder,{recursive:true});
    await page.screenshot({path:resolve(folder,'removed-1440.png')});
    await page.setViewportSize({width:390,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'the removed member sign-in fits the phone viewport');
    await page.screenshot({path:resolve(folder,'removed-390.png')});
   },
   close:()=>browser.close(),
  };
 }catch(error){await browser.close();throw error}
}

// Member assignment uses the same issue controls and native session as ordinary triage.
export async function assignmentBrowser(actor,project,issue,departing,remaining,remainingActor=actor) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),split=actor.cookie.indexOf('=');
  await context.addCookies([{name:actor.cookie.slice(0,split),value:actor.cookie.slice(split+1),url:actor.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage(),url=actor.origin+'/projects/'+project.id+'/issues/'+issue.id;
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Operator decisions',exact:true})});
  async function save(member) {
   await panel.getByLabel('Assigned member',{exact:true}).selectOption(member.id);
   const saved=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/assignment')&&response.request().method()==='PATCH');
   await panel.getByRole('button',{name:'Save assignment',exact:true}).click();assert.equal((await saved).status(),200);
   await expect(panel.getByText('Current assignment:',{exact:false})).toContainText(member.name);
   await expect(panel.getByLabel('Assigned member',{exact:true})).toBeEnabled();
  }
  await page.goto(url);await save(departing);
  return {
   async reassign() {
    await context.clearCookies();
    const separator=remainingActor.cookie.indexOf('=');
    await context.addCookies([{name:remainingActor.cookie.slice(0,separator),value:remainingActor.cookie.slice(separator+1),url:remainingActor.origin.replace('http:','https:'),secure:true}]);
    await page.reload();
    await expect(panel.getByText('Current assignment:',{exact:false})).toContainText('Former project member');
    await expect(panel.getByLabel('Assigned member',{exact:true}).locator('option[value="'+departing.id+'"]')).toHaveCount(0);
    await save(remaining);
    await panel.getByRole('button',{name:'Details: Assignment history',exact:true}).click();
    await expect(panel.getByText(/Former project member/).first()).toBeVisible();
    assert.equal(await panel.locator('input,select,button,label,p,li').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).every(node=>parseFloat(getComputedStyle(node).fontSize)>=13)),true);
    const violations=(await new AxeBuilder({page}).include('main').analyze()).violations.filter(row=>['serious','critical'].includes(row.impact));assert.deepEqual(violations,[],'the issue assignment controls have no serious accessibility violation');
    const folder=process.env.SPOOL_TEAM_EVIDENCE||'.artifacts/team';await mkdir(folder,{recursive:true});
    await page.screenshot({path:resolve(folder,'assignment-1440.png')});
    await page.setViewportSize({width:390,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'assignment controls and history fit the phone viewport');
    assert.equal(await page.getByRole('dialog',{name:'Assignment history',exact:true}).evaluate(node=>node.scrollWidth<=node.clientWidth),true,'safe aliases remain inspectable without horizontal clipping');
    await page.screenshot({path:resolve(folder,'assignment-390.png')});
   },
   close:()=>browser.close(),
  };
 }catch(error){await browser.close();throw error}
}
