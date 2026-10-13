import {chromium} from '@playwright/test';

export function launchBrowser() {
  const channel = process.env.ERRORS_BROWSER_CHANNEL;
  return chromium.launch({headless: true, ...(channel ? {channel} : {})});
}
