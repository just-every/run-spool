import {chromium} from '@playwright/test';

export function launchBrowser() {
  const executablePath = process.env.RER_CHROMIUM_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return chromium.launch({headless: true, ...(executablePath ? {executablePath} : {}), args: ['--use-mock-keychain', '--password-store=basic', '--no-sandbox']});
}
