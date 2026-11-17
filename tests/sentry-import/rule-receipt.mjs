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
  await page.goto(`${origin}/projects/${project}/settings#settings-data`);
  await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
  const receipt=page.getByRole('dialog',{name:'Business imports',exact:true});
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   await receipt.getByText('Rules are not carried over yet: 2 rule(s) not imported',{exact:true}).waitFor();
   if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'the import receipt fits the viewport');
   await page.screenshot({path:join(output,`rule-receipt-${width}.png`)});
  }
 } finally {await browser.close()}
}
