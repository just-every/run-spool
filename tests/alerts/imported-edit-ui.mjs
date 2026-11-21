import { expect } from '@playwright/test';
import { launchBrowser } from '../browser-launch.mjs';
import { openAlertDetails, workbenchLink } from '../navigation.mjs';

export async function importedAlertEditNames({ origin, cookie, project, name }) {
 const browser = await launchBrowser();
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const split = cookie.indexOf('=');
  await context.addCookies([{
   name: cookie.slice(0, split), value: cookie.slice(split + 1),
   url: origin.replace('http:', 'https:'), secure: true,
  }]);
  const page = await context.newPage();
  await page.goto(origin + '/projects/' + project + '/settings');
  await (await workbenchLink(page, 'Alerts')).click();
  const button = name => page.getByRole('button', { name, exact: true });
  const heading = name => page.getByRole('heading', { name, exact: true });
  await button('Rules').click();
  await openAlertDetails(page);

  const destination = button(`Edit destination ${name}`);
  const rule = button(`Edit rule ${name}`);
  await expect(destination).toHaveCount(1);
  await expect(rule).toHaveCount(1);
  await expect(button(`Edit ${name}`)).toHaveCount(0);

  await destination.click();
  await expect(heading('Edit destination')).toBeVisible();
  await expect(page.getByLabel('Destination name', { exact: true })).toHaveValue(name);
  await expect(heading('Edit rule')).toHaveCount(0);
  await button('Cancel destination edit').click();

  await rule.click();
  await expect(heading('Edit rule')).toBeVisible();
  await expect(page.getByLabel('Rule name', { exact: true })).toHaveValue(name);
  await expect(heading('Edit destination')).toHaveCount(0);
 } finally {
  await browser.close();
 }
}
