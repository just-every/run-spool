import {chromium} from '@playwright/test';

export function launchBrowser() {
  return chromium.launch({headless: true, ...process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}, args: ['--use-mock-keychain', '--password-store=basic', '--no-sandbox']});
}
