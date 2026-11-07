import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchBrowser } from '../browser-launch.mjs';
export async function rollbarScreens(origin,cookie,project,issue) {
 const browser=await launchBrowser();
 try {
  const context=await browser.newContext(),split=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();
  await mkdir('.artifacts/rollbar-import',{recursive:true});
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   await page.goto(`${origin}/projects/${project}/issues/${issue}`);
   await page.getByRole('heading',{name:'Checkout failure 1',exact:true}).waitFor();
   await page.screenshot({path:`.artifacts/rollbar-import/issue-${width}.png`,fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'imported issue fits the viewport');
   await page.goto(`${origin}/projects/${project}/settings`);
   await page.getByText('Business imports',{exact:true}).first().waitFor();
   await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
   await page.getByText('rollbar-project:71',{exact:true}).waitFor();
   await page.screenshot({path:`.artifacts/rollbar-import/history-${width}.png`,fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'import history fits the viewport');
  }
 } finally {await browser.close();}
}
