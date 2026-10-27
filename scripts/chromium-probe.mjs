import {chromium} from '@playwright/test';

// Exercise the bundled headless shell with Playwright's normal default arguments.
// Do not replace HOME or use a system browser: the journeys use this same launch.
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-mock-keychain', '--password-store=basic'],
    timeout: 15_000,
  });
  const page = await browser.newPage();
  await page.setContent('<title>Chromium probe</title>');
  if (await page.title() !== 'Chromium probe') throw Error('Chromium page probe failed');
} finally {
  await browser?.close();
}
