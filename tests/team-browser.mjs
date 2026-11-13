import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {launchBrowser} from './browser-launch.mjs';
import {startDispatchApp} from './triage-app.mjs';
import {workbenchLink} from './navigation.mjs';
import {admissionRuntime} from './admission-runtime.mjs';
import {testSetupToken} from './auth.mjs';
import {teamViewportProof,teamKeyboardDetails} from './team-viewport.mjs';

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
  assert.equal((await owner.json(organization+'/me')).mailSuppressed,false);
  assert.ok((await owner.json(organization)).invites.every(row=>!row.localLink),'mail-sending runtime returns no local invitation links');
  await members.locator('summary').filter({hasText:/^Invitations$/}).click();
  await expect(members.getByRole('button',{name:'Copy invitation link',exact:true})).toHaveCount(0);
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
  await usageLabels(page,owner,projects[0]);
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

/** UX-001: each native team performs the whole mobile-web path at its own width. */
export async function teamTriage(owner,member,project,width) {
 const browser=await launchBrowser();let application;
 const root='/api/projects/'+project.id,origin=owner.origin,release='synthetic-spool-ux';
 const folder=process.env.SPOOL_TEAM_EVIDENCE||'.artifacts/team';await mkdir(folder,{recursive:true});
 const activate=control=>width===390?control.tap():control.click();
 const probe=(point,outcome)=>console.log('PROBE UX-001 '+point+' '+width+': '+outcome);
 try {
  async function contextFor(cookie) {
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:true});
   const split=cookie.indexOf('=');
   await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
   return context;
  }
  const memberContext=await contextFor(member.cookie),ownerContext=await contextFor(owner.cookie);
  const memberPage=await memberContext.newPage(),ownerPage=await ownerContext.newPage();
  const errors=[];for(const page of [memberPage,ownerPage])page.on('pageerror',error=>errors.push(error.message));
  async function screen(page,name,target) {
   await teamViewportProof(page,name);
   if(target)await target.scrollIntoViewIfNeeded();else await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:resolve(folder,name+'-'+width+'.png'),fullPage:false});
  }

  await memberPage.goto(origin+'/projects/'+project.id+'/releases');
  await memberPage.getByLabel('Release name',{exact:true}).fill(release);
  await memberPage.getByLabel('Build identifier',{exact:true}).fill('web');
  const registered=memberPage.waitForResponse(response=>new URL(response.url()).pathname===root+'/releases'&&response.request().method()==='POST');
  await activate(memberPage.getByRole('button',{name:'Register release',exact:true}));assert.equal((await registered).status(),201);
  assert.ok((await owner.json(root+'/releases')).some(row=>row.name===release&&row.build==='web'),'the member registered the real release');
  application=await startDispatchApp({endpoint:origin,project:project.id,ingestKey:project.ingestKey,release,build:'web',environment:'production',debugId:release});
  await owner.json(root+'/browser-origins','POST',{origin:application.origin});
  const capturePage=await memberContext.newPage();await capturePage.goto(application.origin);
  await activate(capturePage.getByRole('button',{name:'Prepare delivery',exact:true}));
  await capturePage.waitForFunction(()=>window.captureOutcome?.outcome==='accepted');
  const captured=await capturePage.evaluate(()=>({outcome:window.captureOutcome,failure:window.captureFailure}));
  const issue=captured.outcome.issue;assert.ok(issue);await capturePage.close();
  const path='/projects/'+project.id+'/issues/'+issue;
  const admitted=await owner.json(root+'/issues/'+issue+'/packet');
  assert.equal(admitted.events.length,1,'this width has its own captured event');
  assert.equal(admitted.events[0].id,captured.outcome.eventId);
  assert.ok(admitted.events[0].event.frames.some(frame=>frame.file===captured.failure.file&&frame.line===captured.failure.line&&frame.column===captured.failure.column),'the retained frames came from the actual second-origin exception');
  probe('capture','Prepare delivery -> accepted second-origin exception and matching retained event');

  await memberPage.goto(origin+path);await memberPage.locator('.missing-map').waitFor();
  await activate(memberPage.getByRole('button',{name:'Upload map',exact:true}));
  await expect(memberPage.getByLabel('Bundle debug ID',{exact:true})).toHaveValue(release);
  await memberPage.getByLabel(/^Source map file/).setInputFiles({name:'dispatch.js.map',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(application.map))});
  const uploaded=memberPage.waitForResponse(response=>new URL(response.url()).pathname===root+'/artifacts'&&response.request().method()==='POST');
  await activate(memberPage.getByRole('button',{name:'Upload matching map',exact:true}));assert.equal((await uploaded).status(),201);
  await memberPage.getByRole('status').filter({hasText:'Source map uploaded'}).waitFor();
  await screen(memberPage,'team-map-upload',memberPage.locator('#upload-map'));
  await activate(memberPage.getByRole('button',{name:'Return to issue',exact:true}));
  const packet=await owner.json(root+'/issues/'+issue+'/packet'),event=packet.events[0],coordinate=event.currentLookup[0].original;
  assert.equal(coordinate.line,application.originalLine);assert.equal(coordinate.column,application.originalColumn);
  assert.deepEqual(event.event,admitted.events[0].event,'mapping retains the original admitted event');
  assert.deepEqual(event.atAdmission,admitted.events[0].atAdmission,'upload cannot rewrite the admission snapshot');
  await expect(memberPage.locator('.frame-coordinate').first()).toHaveText(coordinate.file+':'+coordinate.line+':'+coordinate.column);
  probe('mapping','prepared matching map picker -> original coordinates and unchanged admission snapshot');

  await activate(await workbenchLink(memberPage,'Issues',false));
  const search=memberPage.getByLabel('Search issues',{exact:true});await search.fill('release:'+release);await search.focus();await expect(search).toBeFocused();
  const match=memberPage.locator('tbody tr').filter({has:memberPage.locator('a[href="'+path+'"]')});
  await expect(match).toHaveCount(1);
  const searched=await member.json(root+'/issue-search?q='+encodeURIComponent('release:'+release));
  assert.deepEqual(searched.rows.map(row=>row.id),[issue],'search reads only this width’s captured issue');
  await teamViewportProof(memberPage,'team-search');await activate(match.getByRole('link'));
  await expect(memberPage.locator('.frame-coordinate').first()).toContainText(coordinate.file);
  // Details returns focus to its trigger again from the dialog's asynchronous close event; let that handler finish before moving focus.
  const detailsClosed=memberPage.evaluate(()=>new Promise(resolve=>document.addEventListener('close',()=>resolve(),{capture:true,once:true})));
  await teamKeyboardDetails(memberPage,'Issue and source evidence',()=>screen(memberPage,'team-evidence-dialog'));await detailsClosed;
  probe('search','release query -> the isolated captured issue and its mapped frame');

  const label=memberPage.getByLabel('Assigned to',{exact:true}),save=memberPage.getByRole('button',{name:'Save assignment',exact:true});
  await label.fill('Cedar responder');await label.focus();await memberPage.keyboard.press('Tab');await expect(save).toBeFocused();
  let releaseAssignment;const gate=new Promise(resolve=>{releaseAssignment=resolve});let assignments=0;
  await memberPage.route('**/assignment',async route=>{if(route.request().method()==='PATCH'){assignments++;await gate;}await route.continue();});
  try {
   const saved=memberPage.waitForResponse(response=>response.url().endsWith('/assignment')&&response.request().method()==='PATCH');
   await activate(save);await expect(save).toBeDisabled();await expect.poll(()=>assignments).toBe(1);
   assert.equal(await save.evaluate(button=>button.disabled),true,'a pending assignment refuses a duplicate activation');
   await save.evaluate(button=>button.click());releaseAssignment();assert.equal((await saved).status(),200);
   await expect(save).toBeEnabled();assert.equal(assignments,1,'a blocked duplicate activation sends exactly one assignment request');
  }finally{releaseAssignment();await memberPage.unroute('**/assignment');}
  assert.equal((await owner.json(root+'/operator-state')).assignments.find(row=>row.issue===issue).label,'Cedar responder');
  await expect(label).toHaveValue('Cedar responder');
  probe('operator-label assignment','busy Save assignment plus duplicate activation -> one request and retained responsibility label');

  const body='synthetic-spool-1 investigating the mapped delivery failure',comment=memberPage.getByLabel('Comment',{exact:true});
  await comment.fill(body);await comment.focus();await memberPage.keyboard.press('Tab');
  const post=memberPage.getByRole('button',{name:'Post comment',exact:true});await expect(post).toBeFocused();
  const posted=memberPage.waitForResponse(response=>new URL(response.url()).pathname===root+'/issues/'+issue+'/comments'&&response.request().method()==='POST');
  await activate(post);assert.ok((await posted).ok(),'the member comment POST is accepted');
  await expect(memberPage.getByRole('region',{name:'Discussion',exact:true}).locator('.commit-message').filter({hasText:body})).toBeVisible();
  assert.ok((await owner.json(root+'/issues/'+issue+'/discussion')).comments.some(row=>row.body===body&&row.author===member.member.name));
  probe('comment','member Post comment -> visible discussion and stored member attribution');
  await screen(memberPage,'team-investigation');

  await activate(await workbenchLink(memberPage,'Alerts'));
  const alert=memberPage.locator('.alert-records li').filter({hasText:packet.issue.title}).first();await alert.waitFor();
  const alerts=await member.json(root+'/alerts');assert.ok(alerts.some(row=>row.issue===issue&&row.kind==='new_issue'),'capture has a persisted matching alert');
  await screen(memberPage,'team-alert');await alert.getByRole('button',{name:'Open issue',exact:true}).tap();
  await memberPage.locator('.mapped-frame').first().waitFor();assert.equal(new URL(memberPage.url()).pathname,path,'the touched alert opens the same mapped issue');
  probe('alert navigation','Open issue by touch -> the same issue deep link and mapped evidence');

  await ownerPage.goto(origin+path);
  const link='https://code.example.test/cedar/repair';
  await ownerPage.getByLabel('Branch or pull request link (https)',{exact:true}).fill(link);
  await ownerPage.getByLabel('Note',{exact:true}).fill('synthetic-spool-1 reviewed with Cedar responder');
  const recorded=ownerPage.waitForResponse(response=>new URL(response.url()).pathname===root+'/repairs'&&response.request().method()==='POST');
  await activate(ownerPage.getByRole('button',{name:'Record repair',exact:true}));assert.equal((await recorded).status(),201);
  const record=ownerPage.locator('article.repair').filter({has:ownerPage.getByRole('link',{name:link,exact:true})});
  const proposed=(await owner.json(root+'/repairs?issue='+issue)).repairs.find(row=>row.link===link);assert.ok(proposed);assert.equal(proposed.facts.approved,null);
  const approved=ownerPage.waitForResponse(response=>new URL(response.url()).pathname===root+'/repairs/'+proposed.id+'/facts'&&response.request().method()==='POST');
  const approve=record.getByRole('button',{name:'Mark approved',exact:true});await approve.focus();await expect(approve).toBeFocused();
  await activate(approve);assert.equal((await approved).status(),200);await expect(record.getByRole('button',{name:'Mark approved',exact:true})).toHaveCount(0);
  assert.ok((await owner.json(root+'/repairs?issue='+issue)).repairs.find(row=>row.id===proposed.id).facts.approved,'the approval is recorded, not merely displayed');
  await teamKeyboardDetails(ownerPage,'Evidence snapshot',()=>screen(ownerPage,'team-repair-dialog'));
  await screen(ownerPage,'team-repair-approved',ownerPage.locator('.repairs'));
  probe('repair approval','owner Record repair and Mark approved -> proposed record then persisted approval fact');

  const missing=await memberPage.goto(origin+'/projects/synthetic-spool-unavailable/issues');assert.equal(missing.status(),404);
  await expect(memberPage.getByRole('heading',{name:'This project is unavailable',exact:true})).toBeVisible();
  await expect(memberPage.getByRole('main')).toContainText('access');await expect(memberPage.getByRole('main')).not.toContainText(packet.issue.title);
  await screen(memberPage,'team-permission');
  assert.deepEqual(errors,[],'the team path has no browser errors');
  console.log('[UX-001] '+width+' native team independently registered, captured, mapped, searched, operator-label assigned without duplicate writes, commented, followed alert by touch and recorded repair approval; keyboard, Axe and reflow passed');
 }finally{await browser.close();await application?.stop();}
}

// Extends the existing TEAM-001 journey: actual mail suppression, pending
// invitation custody and unchanged native confirmation, with no provider fake.
export async function localMailFlow() {
 console.log('Local mail journey: starting emitted app');
 const app=await admissionRuntime();let browser;
 console.log('Local mail journey: emitted app ready');
 try {
  const bootstrap=await app.call('/auth/bootstrap',{token:testSetupToken,displayName:'Synthetic local owner'});
  assert.equal(bootstrap.status,303);const cookie=bootstrap.headers.get('set-cookie').split(';')[0];await bootstrap.arrayBuffer();
  const request=(path,value,headers={},method)=>app.call(path,value,{Cookie:cookie,...headers},method);
  const json=async(path,value)=>{const response=await request(path,value);assert.ok(response.ok,path+' '+response.status);return response.json()};
  await json('/api/organization',{id:'synthetic-spool-local',name:'Synthetic local team'});
  const project=await json('/api/projects',{id:'synthetic-spool-local',name:'Synthetic local project'});
  assert.equal((await json('/api/organization/me')).mailSuppressed,true);
  console.log('Local mail journey: owner and project created');
  browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const split=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:app.origin}]);
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const settings=app.origin+'/projects/'+project.id+'/settings';await page.goto(settings);
  const members=page.getByRole('region',{name:'Members',exact:true});
  await members.locator('summary').filter({hasText:/^Invite a member$/}).click();
  await members.getByLabel('Email',{exact:true}).fill('synthetic-spool-local@example.test');
  await members.getByLabel('Name',{exact:true}).fill('Synthetic local invitee');
  await members.getByLabel(/^Organization role/).selectOption('read-only');
  await members.locator('form').filter({has:page.getByLabel('Email',{exact:true})}).getByLabel(new RegExp('^'+project.name)).selectOption('read-only');
  const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/organization/invites'&&r.request().method()==='POST');
  await members.getByRole('button',{name:'Create invitation',exact:true}).click();assert.equal((await pending).status(),202);
  await expect(members.getByRole('status')).toBeVisible();
  // A reload proves the pending link survives navigation without minting a new token.
  await page.reload();await members.locator('summary').filter({hasText:/^Invitations$/}).click();
  const input=members.getByLabel('Invitation link for synthetic-spool-local@example.test',{exact:true});await input.waitFor();
  const link=await input.inputValue(),token=new URL(link).searchParams.get('token');assert.ok(token);
  assert.equal(new URL(link).origin,app.origin);
  const native=await app.DB.prepare("SELECT t.id,t.expires_at,t.consumed_at,t.revoked_at,l.envelope FROM oa_tokens t JOIN spool_local_invite_links l ON l.token_id=t.id").first();
  assert.ok(native.expires_at>Date.now());assert.equal(native.consumed_at,null);assert.equal(native.revoked_at,null);
  assert.ok(!native.envelope.includes(token),'the stored copy is encrypted');
  console.log('Local mail journey: pending native link available after reload');
  const beforeTokens=(await app.DB.prepare('SELECT COUNT(*) n FROM oa_tokens').first()).n;
  await members.getByRole('button',{name:'Copy invitation link',exact:true}).click();
  assert.ok(await page.evaluate(async value=>(await navigator.clipboard.readText())===value,link),'clipboard contains the pending native link');
  assert.equal((await app.DB.prepare('SELECT COUNT(*) n FROM oa_tokens').first()).n,beforeTokens,'copy creates no second token');
  await members.locator('summary').filter({hasText:/^Verify identity for ownership transfer$/}).click();
  const stepUp=page.waitForResponse(r=>new URL(r.url()).pathname==='/auth/step-up'&&r.request().method()==='POST');
  await members.getByRole('button',{name:'Verify your identity',exact:true}).click();assert.equal((await stepUp).status(),202);
  const challenge=await app.DB.prepare('SELECT consumed_at FROM oa_step_up_challenges ORDER BY created_at DESC LIMIT 1').first();
  assert.equal(challenge.consumed_at,null,'requesting suppressed mail creates no step-up proof');
  assert.equal((await app.DB.prepare('SELECT COUNT(*) n FROM rer_mail_development_outbox').first()).n,0,'local mail is neither sent nor retained as a mailbox');
  const folder=process.env.SPOOL_LOCAL_MAIL_EVIDENCE;
  if(folder){
   await mkdir(folder,{recursive:true});
   await members.screenshot({path:resolve(folder,'local-members-1440.png'),mask:[input]});
   await page.setViewportSize({width:390,height:1000});
   await members.screenshot({path:resolve(folder,'local-members-390.png'),mask:[input]});
   await page.setViewportSize({width:1440,height:1000});
  }
  console.log('Local mail journey: copy and verification complete');
  const inviteeContext=await browser.newContext({viewport:{width:1440,height:1000}}),invitee=await inviteeContext.newPage();invitee.setDefaultTimeout(20000);
  await invitee.goto(link);const confirmed=invitee.waitForResponse(r=>new URL(r.url()).pathname==='/auth/confirm'&&r.request().method()==='POST');
  await invitee.getByRole('button',{name:'Confirm',exact:true}).click();assert.equal((await confirmed).status(),303);
  const session=await inviteeContext.request.get(app.origin+'/auth/session');assert.equal(session.status(),200);
  assert.equal((await session.json()).operator.role,'member');
  const access=await (await inviteeContext.request.get(app.origin+'/api/organization/me')).json();assert.equal(access.role,'read-only');assert.deepEqual(access.projects.map(row=>row.id),[project.id]);
  const refused=await inviteeContext.request.post(app.origin+'/auth/confirm',{headers:{Origin:app.origin},data:{token}});assert.equal(refused.status(),400,'the very same link cannot be accepted twice');
  assert.equal((await refused.json()).error,'invalid_or_expired');
  const after=(await json('/api/organization')).invites;assert.ok(after.every(row=>!row.localLink),'accepted links are no longer exposed');
  const member=(await json('/api/organization')).members.find(row=>row.name==='Synthetic local invitee');
  const transfer=await request('/api/organization/transfer',{member:member.id,version:member.version});assert.equal(transfer.status,403);assert.equal((await transfer.json()).error,'step_up_required','local messaging does not bypass native ownership proof');
  assert.equal((await inviteeContext.request.get(app.origin+'/api/organization')).status(),404,'read-only invitee cannot read invitation custody');
  const archive=await request('/api/archive');assert.equal(archive.status,200);const archiveText=await archive.text();
  const archivedItems=archiveText.trim().split('\n').flatMap(line=>JSON.parse(line).items??[]);
  assert.ok(!archivedItems.some(item=>item.kind==='row'&&item.table==='spool_local_invite_links')&&!archiveText.includes(token)&&!archiveText.includes(native.envelope),'private archives contain no local token custody');
  await json('/api/organization/invites',{email:'synthetic-spool-expiry@example.test',name:'Synthetic expiry invitee',role:'read-only',grants:[]});
  const expiryData=await json('/api/organization'),expiryLink=expiryData.invites.find(row=>row.localLink)?.localLink;assert.ok(expiryLink);
  const expiryToken=new URL(expiryLink).searchParams.get('token');
  await app.DB.prepare('UPDATE oa_tokens SET expires_at=? WHERE id IN (SELECT token_id FROM spool_local_invite_links WHERE invite=?)').bind(Date.now()-1,expiryData.invites.find(row=>row.localLink).id).run();
  assert.ok((await json('/api/organization')).invites.every(row=>!row.localLink),'expired native links are no longer exposed');
  const expired=await app.call('/auth/confirm',{token:expiryToken});assert.equal(expired.status,400);await expired.arrayBuffer();
  console.log('PROBE TEAM-001 local invitation: suppressed mail; copy after reload; same native expiring token; second browser acceptance once; roles, expiry, read-only denial and archive exclusion preserved.');
  console.log('PROBE GOV-001 local verification: request produces no completed proof and native transfer still refuses without email confirmation.');
 }finally{await browser?.close();await app.close()}
}

// Extend the existing organization journey with real intake counters.
export async function usageLabels(page,owner,project) {
 const root='/api/projects/'+project.id,release='synthetic-spool-readable';
 await owner.json(root+'/releases','POST',{name:release,build:'b1'});
 const grant=await owner.json(root+'/keys','POST',{kind:'ingest'}),snapshot=await owner.json(root+'/inbound-filters');
 const policy=structuredClone(snapshot.policy);policy.filters.environments={enabled:true,values:['synthetic-spool-filtered']};
 await owner.json(root+'/inbound-filters','PUT',{revision:snapshot.revision,policy});
 const event={version:1,eventId:'synthetic-spool-readable',release,build:'b1',environment:'synthetic-spool-filtered',type:'Error',message:'Filtered usage example',frames:[{file:'usage.js',line:1,column:0,function:'capture'}]};
 const filtered=await owner.req('/api/ingest/'+project.id,'POST',event,{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal((await filtered.json()).outcome,'filtered');
 for(const expected of ['accepted','duplicate']){const response=await owner.req('/api/ingest/'+project.id,'POST',{...event,eventId:'synthetic-spool-counted',environment:'synthetic-spool-accepted'},{Cookie:'',Authorization:'Bearer '+grant.key});assert.equal((await response.json()).outcome,expected);}
 const usage=await owner.json('/api/organization/usage');assert.ok(usage.usage.some(row=>row.project===project.id&&row.reason==='filtered:environments'&&row.count>0));
 await page.setViewportSize({width:1440,height:1000});await page.goto(owner.origin+'/projects/'+project.id+'/settings#settings-organization');
 const members=page.getByRole('region',{name:'Members',exact:true}),section=members.locator('details').filter({has:page.locator('summary').getByText('Usage',{exact:true})});await section.locator('summary').click();await section.locator('.data-row').first().waitFor();
 await expect(section.locator('.data-row')).toHaveCount(usage.usage.length,{timeout:20000});
 const text=await section.innerText();for(const row of usage.usage.filter(row=>/[_:]/.test(row.reason)))assert.ok(!text.includes(row.reason),'Usage labels hide internal reason codes');assert.match(text,/environment/i);
 const folder=process.env.SPOOL_TEAM_EVIDENCE||'.artifacts/team';for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await section.screenshot({path:resolve(folder,'usage-'+width+'.png')});}
 const latest=await owner.json(root+'/inbound-filters');await owner.json(root+'/inbound-filters','PUT',{revision:latest.revision,policy:snapshot.policy});
}
