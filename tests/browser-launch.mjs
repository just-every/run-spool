import {chromium} from '@playwright/test';

export function launchBrowser() {
  return chromium.launch({headless: true, ...(process.env.RER_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.RER_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox']} : {})});
}
