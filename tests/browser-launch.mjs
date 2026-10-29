import {chromium} from '@playwright/test';

export function launchBrowser() {
  return chromium.launch({headless: true});
}
