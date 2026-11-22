import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

export async function localPasskeyJourney(browser, origin, openUrl, width, capture = async () => {}) {
 const context = await browser.newContext({ viewport: { width, height: 900 } });
 try {
  const page = await context.newPage();
  const signIn = page.getByRole('button', { name: /sign in with a passkey/i });
  await page.goto(origin + '/sign-in');
  await expect(signIn).toHaveCount(0);
  assert.equal(await page.evaluate(() => isSecureContext), true);

  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
   options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true,
   },
  });

  // RER_OPEN is a private terminal link. Never include its URL in a test failure.
  try { await page.goto(openUrl); } catch { assert.fail('Opening the private localhost owner link failed'); }
  await page.waitForURL(url => !url.hash && !url.pathname.startsWith('/__dev/'));
  const project = (await (await context.request.get(origin + '/api/projects')).json())[0];
  assert.ok(project, 'the owner link opens the installation with its existing project');
  const settings = '/projects/' + encodeURIComponent(project.id) + '/settings';
  await page.goto(origin + settings + '#settings-general');
  const add = page.getByRole('button', { name: /add passkey/i });
  await expect(add).toBeVisible();
  await capture('passkey-settings', page);
  await add.click();
  await expect(page.getByRole('button', { name: /remove passkey/i })).toBeVisible();
  assert.equal((await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials.length, 1);
  await capture('passkey-enrolled', page);

  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/sign-in');
  // The passkey must work without any credential from the terminal link.
  await context.clearCookies();
  await page.goto(origin + '/sign-in?returnTo=' + encodeURIComponent(settings + '#settings-general'));
  await expect(signIn).toBeVisible();
  await capture('passkey-signed-out', page);
  await signIn.click();
  await page.waitForURL(url => url.pathname === settings && url.hash === '#settings-general');
  const session = await context.request.get(origin + '/auth/session');
  assert.equal(session.status(), 200);
  assert.equal((await session.json()).operator.role, 'owner');
  assert.equal((await context.request.get(origin + '/__dev/personas')).status(), 404, 'passkey signs in without granting the terminal owner gate');
  const remove = page.getByRole('button', { name: /remove passkey/i });
  await expect(remove).toBeVisible();
  await capture('passkey-signed-in', page);

  await remove.click();
  await expect(add).toBeVisible();
  await context.clearCookies();
  await page.goto(origin + '/sign-in');
  await expect(signIn).toHaveCount(0);
 } finally {
  await context.close();
 }
}
