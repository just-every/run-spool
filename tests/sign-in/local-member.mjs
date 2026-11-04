import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

/** Real rer-dev page journey: silent invitation, member entry and re-entry. */
export async function localMemberSignInJourney(browser, origin, ownerContext) {
 const fresh = await browser.newContext({viewport:{width:1440,height:900}});
 try {
  const page = await fresh.newPage();
  assert.equal((await page.goto(origin+'/sign-in')).status(),200);
  await expect(page.getByText('rer dev --as owner',{exact:true})).toBeVisible();
  assert.equal(await page.locator('a[href^="/auth/dev/enter"]').count(),0);
  assert.equal((await fresh.request.get(origin+'/auth/dev/enter?as=owner')).status(),404,'local entry remains gated');
  assert.equal((await fresh.request.get(origin+'/api/projects')).status(),401);
 } finally {await fresh.close();}

 const ownerPage = await ownerContext.newPage();
 const memberContext = await browser.newContext({viewport:{width:1440,height:900}});
 try {
  const organization = await ownerContext.request.post(origin+'/api/organization',{headers:{Origin:origin},data:{id:'synthetic-spool-1',name:'synthetic-spool-1'}});
  assert.equal(organization.status(),201);
  await ownerPage.goto(origin+'/projects/journey/settings');
  const members = ownerPage.getByRole('region',{name:'Members',exact:true});
  await members.locator('summary').filter({hasText:/^Invite a member$/}).click();
  const email = 'synthetic-spool-2@example.test';
  const form = members.locator('form').filter({has:ownerPage.getByLabel('Email',{exact:true})});
  await form.getByLabel('Email',{exact:true}).fill(email);
  await form.getByLabel('Name',{exact:true}).fill('synthetic-spool-2');
  await form.getByLabel(/^Organization role/).selectOption('member');
  await form.getByLabel(/^Journey/).selectOption('member');
  const sent = ownerPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/organization/invites'&&r.request().method()==='POST');
  await form.getByRole('button',{name:'Send invitation',exact:true}).click();
  assert.equal((await sent).status(),202);
  await members.locator('summary').filter({hasText:/^Invitations$/}).click();
  const command = members.getByLabel(`Local sign-in command for ${email}`,{exact:true});
  await expect(command).toBeVisible();
  assert.equal(await command.innerText(),`rer dev --as '${email}'`,'the local invitation names the member command');
  await ownerContext.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  await members.getByRole('button',{name:'Copy sign-in command',exact:true}).click();
  assert.equal(await ownerPage.evaluate(()=>navigator.clipboard.readText()),await command.innerText());
  await ownerPage.evaluate(()=>navigator.clipboard.writeText(''));
  assert.equal((await (await ownerContext.request.get(origin+'/api/organization')).json()).localSignIn,true);

  // A private RER_OPEN link admits this browser. Keep its genuine gate cookie
  // in memory, without giving it the owner's application session.
  const gateCookies = (await ownerContext.cookies()).filter(cookie=>cookie.name.startsWith('rer_dev_gate_'));
  assert.equal(gateCookies.length,1);
  await memberContext.addCookies(gateCookies);
  const memberPage = await memberContext.newPage();
  await memberPage.goto(origin+'/sign-in');
  const entry = memberPage.getByRole('link',{name:`Continue as ${email}`,exact:true});
  await entry.click();
  await memberPage.waitForURL(url=>url.pathname==='/projects/journey/issues');
  let session = await (await memberContext.request.get(origin+'/auth/session')).json();
  assert.equal(session.operator.email,email);assert.equal(session.operator.role,'member');
  assert.equal((await memberContext.request.get(origin+'/api/organization')).status(),404,'member entry does not acquire owner authority');
  const signedOut = await memberContext.request.post(origin+'/auth/signout',{maxRedirects:0,headers:{Origin:origin}});
  assert.equal(signedOut.status(),204);
  await memberPage.goto(origin+'/sign-in');
  await entry.click();
  await memberPage.waitForURL(url=>url.pathname==='/projects/journey/issues');
  session = await (await memberContext.request.get(origin+'/auth/session')).json();
  assert.equal(session.operator.email,email);assert.equal(session.operator.role,'member','re-entry retains member identity');
 } finally {await memberContext.close();await ownerPage.close();}
}
