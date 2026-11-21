import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchBrowser } from '../browser-launch.mjs';

export async function approveOnReceipt({origin,cookie,project,definitions,output}) {
 const browser=await launchBrowser();
 try {
  await mkdir(output,{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const split=cookie.indexOf('=');
  await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
  const page=await context.newPage();
  await page.goto(origin+'/projects/'+project+'/settings#settings-data');
  await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
  const receipt=page.getByRole('dialog',{name:'Business imports',exact:true});
  const button=receipt.getByRole('button',{name:'Create these rules'});
  await button.waitFor();
  await button.click();
  await button.waitFor({state:'hidden'});
  for(const name of definitions)await receipt.getByText(name,{exact:true}).waitFor();
  assert.ok(await receipt.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'receipt fits the reviewed desktop width');
  // The public receipt proof omits the synthetic account address in the approval caption.
  const proof={mask:[receipt.locator('p').filter({hasText:/approved by \S+@/i})],maskColor:'#d0d5dd'};
  await page.screenshot({...proof,path:join(output,'receipt-1440.png')});
  await page.setViewportSize({width:390,height:1000});
  await page.screenshot({...proof,path:join(output,'receipt-390.png')});
 } finally {await browser.close()}
}
