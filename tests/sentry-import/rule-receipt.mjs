import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchBrowser } from '../browser-launch.mjs';

export async function ruleReceiptScreens(origin,cookie,project) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext(),split=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage(),output=process.env.SPOOL_IMPORT_SCREENS??'.artifacts/sentry-import';
  await mkdir(output,{recursive:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${origin}/projects/${project}/settings#settings-data`);
  await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
  const receipt=page.getByRole('dialog',{name:'Business imports',exact:true});
  await receipt.getByText('Rules are not carried over yet: 2 rule(s) not imported',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'the import receipt fits the viewport');
  await page.screenshot({path:join(output,'rule-receipt-1440.png')});
  await page.setViewportSize({width:390,height:1000});
  await page.screenshot({path:join(output,'rule-receipt-390.png')});
 } finally {await browser.close()}
}
