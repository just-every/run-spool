import {chromium} from '@playwright/test';

export async function launchBrowser() {
  const browser=await chromium.launch({headless:true, ...(process.env.SPOOL_CHROMIUM_PATH ? {executablePath:process.env.SPOOL_CHROMIUM_PATH} : {}), args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
  const newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser);
  browser.newContext=options=>newContext({viewport:{width:1440,height:900},...options});
  browser.newPage=options=>newPage({viewport:{width:1440,height:900},...options});
  return browser;
}
