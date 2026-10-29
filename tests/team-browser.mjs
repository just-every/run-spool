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

// The writer saves through the real screen; a separate native session reopens it.
export async function sharedViewBrowser(writer,teammate,project,query) {
 const browser=await launchBrowser(),folder=process.env.SPOOL_TEAM_EVIDENCE || '.artifacts/team';
 await mkdir(folder,{recursive:true});
 async function open(actor,width) {
  const context=await browser.newContext({viewport:{width,height:1000}}),split=actor.cookie.indexOf('=');
  await context.addCookies([{name:actor.cookie.slice(0,split),value:actor.cookie.slice(split+1),url:actor.origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();await page.goto(actor.origin+'/projects/'+project.id+'/issues');
  await expect(page.locator('.issue-browser')).toHaveAttribute('aria-busy','false');
  return {context,page};
 }
 try {
  const {context,page}=await open(writer,1440);let view,expected;
  try {
   await page.getByRole('searchbox',{name:'Search issues',exact:true}).fill(query.q);
   await page.getByRole('combobox',{name:/^Sort/}).selectOption(query.sort);
   await expect(page.locator('.issue-browser')).toHaveAttribute('aria-busy','false');
   const saved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/review/views')&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Save current view',exact:true}).click();const response=await saved;assert.equal(response.status(),201);view=await response.json();assert.deepEqual(view.query,query);
   await expect(page.getByLabel('Saved views',{exact:true})).toHaveValue(view.id);
   expected=await page.locator('.issue-table tbody tr').allTextContents();assert.ok(expected.length>0,'the saved query has visible retained results');
   await page.screenshot({path:resolve(folder,'saved-view-writer-1440.png'),fullPage:true});
  }finally{await context.close()}
  for(const width of [1440,390]) {
   const {context,page}=await open(teammate,width);
   try {
    await expect(page.getByLabel('Saved views',{exact:true}).locator('option[value="'+view.id+'"]')).toHaveCount(1);
    await page.getByLabel('Saved views',{exact:true}).selectOption(view.id);
    await expect(page.getByRole('searchbox',{name:'Search issues',exact:true})).toHaveValue(query.q);
    await expect(page.getByRole('combobox',{name:/^Sort/})).toHaveValue(query.sort);
    await expect(page.locator('.issue-browser')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('.issue-table tbody tr')).toHaveText(expected);
    if(width===1440) {
     assert.equal(await page.locator('.issue-browser input,.issue-browser select,.issue-browser button,.issue-browser p,.issue-browser td').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)),true);
     const violations=(await new AxeBuilder({page}).include('.issue-browser').analyze()).violations.filter(v=>['serious','critical'].includes(v.impact));assert.deepEqual(violations,[]);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'a shared saved query fits the viewport');
    await page.screenshot({path:resolve(folder,'shared-view-'+width+'.png'),fullPage:true});
   }finally{await context.close()}
  }
  return view;
 }finally{await browser.close()}
}
