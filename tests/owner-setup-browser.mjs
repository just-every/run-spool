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
  await page.goto(app.origin+'/projects/'+project.id+'/settings');
  const members=page.getByRole('region',{name:'Members',exact:true});
  await members.locator('summary').filter({hasText:/^Invite a member$/}).click();
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
  const firstKey=await page.locator('[data-secret="project-key"] pre').innerText();await page.getByRole('button',{name:'Copy Project key',exact:true}).click();
  assert.equal(await page.evaluate(async key=>(await navigator.clipboard.readText())===key,firstKey),true);await page.evaluate(()=>navigator.clipboard.writeText(''));await screenshot('settings-issued');
  await page.getByRole('link',{name:'open Capture to copy and test this key',exact:true}).click();
  assert.equal((await page.getByLabel('Ingest key',{exact:true}).innerText())===firstKey,true,'navigation retains the same issued key in memory');
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
