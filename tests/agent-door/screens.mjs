import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function agentScreens(app){
 const directory=resolve(process.env.SPOOL_AGENT_SCREENSHOTS??'.artifacts/agent-door');await mkdir(directory,{recursive:true});
 const browser=await chromium.launch({headless:true,...process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{},args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{Cookie:app.cookie}});
 const page=await context.newPage(),results=[];
 return {async capture(name,path,expected){
  await page.setViewportSize({width:1440,height:1000});await page.goto(app.origin+path);await page.locator('main').waitFor();
  if(expected)await page.getByText(expected,{exact:false}).first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Changed page has no horizontal overflow at 1440');
  const axe=await new AxeBuilder({page}).analyze();const serious=axe.violations.filter(v=>['serious','critical'].includes(v.impact));assert.deepEqual(serious.map(v=>v.id),[],name+' serious/critical accessibility');
  const controls=await page.locator('button:not([disabled])').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0}).map(n=>({text:n.textContent?.trim().slice(0,70),height:n.getBoundingClientRect().height})));
  assert.ok(controls.every(c=>c.height>=44),name+' button hit targets are at least 44px: '+JSON.stringify(controls.filter(c=>c.height<44)));
  await page.screenshot({path:resolve(directory,name+'-1440.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(directory,name+'-390.png'),fullPage:true});
  results.push({name,path,axeSeriousCritical:serious.length,buttonCount:controls.length,screens:[1440,390]});
 },async close(){await browser.close();await writeFile(resolve(directory,'screens.json'),JSON.stringify(results,null,2)+'\n');}};
}
