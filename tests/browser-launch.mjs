import {chromium} from '@playwright/test';

export function launchBrowser() {
  return chromium.launch({headless: true, executablePath: process.env.SPOOL_TEST_CHROMIUM || undefined,
    args: ['--use-mock-keychain', '--password-store=basic', ...(process.env.SPOOL_TEST_CHROMIUM ? ['--no-sandbox'] : [])]});
}
