import {chromium} from '@playwright/test';

// The mock keychain and basic password store keep a local headless run away from
// the host's login keychain; CI ignores them.
export function launchBrowser() {
  return chromium.launch({headless: true, args: ['--use-mock-keychain', '--password-store=basic']});
}
