import {chromium} from '@playwright/test';

export function launchBrowser() {
  return chromium.launch({headless: true, args: ['--use-mock-keychain', '--password-store=basic']});
}
