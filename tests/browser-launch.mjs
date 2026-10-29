import {chromium} from '@playwright/test';

export function launchBrowser() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({headless: true, ...(executablePath ? {executablePath, args: ['--no-sandbox']} : {})});
}
