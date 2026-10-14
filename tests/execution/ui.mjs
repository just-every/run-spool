import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';
import {runner} from './reproduce.mjs';
// The issue page's reproduce-and-fix section at 1440 and 390: axe, no
// horizontal overflow, and a sandbox run queued by clicking and then run.
export async function executionPanel(app,browser,directory,issue,reproducer){
 const captures=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);
   await context.addCookies([{name:app.cookie.slice(0,app.cookie.indexOf('=')),value:app.cookie.slice(app.cookie.indexOf('=')+1),url:app.origin}]);
   const page=await context.newPage();await page.goto(`${app.origin}/projects/shop/issues/${issue}`);
   const section=page.locator('section.execution');await section.getByRole('heading',{name:'Reproduce and fix'}).waitFor();
   await section.getByText('After the deploy: Reached the affected users').waitFor();
   const card=section.locator('article.reproducer').filter({hasText:'Exact input'}).filter({hasText:'lineCount(…)'}).first();
   const before=await card.locator('.run.reproduced').count();
   await card.getByRole('button',{name:'Queue sandbox run'}).click();
   const command=await section.locator('.run-ticket code').innerText();
   const result=await runner(command);assert.equal(result.code,0,result.output);
   await page.getByRole('button',{name:'Refresh',exact:true}).click();
   await page.waitForFunction(([count])=>document.querySelectorAll('section.execution article.reproducer .run.reproduced').length>count,[before]);
   // The exact grant opens in its dialog; Escape returns.
   await section.getByRole('button',{name:'Details: Exact grant'}).first().click();
   const dialog=page.getByRole('dialog',{name:'Exact grant'});await dialog.getByText('revoked after each step').waitFor();
   const grant=`${directory}/execution-grant-${width}.png`;await page.screenshot({path:grant});captures.push(grant);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`no horizontal overflow at ${width}`);
   const audit=await new AxeBuilder({page}).include('section.execution').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   assert.deepEqual(audit.violations.map(row=>row.id),[],`axe at ${width}`);
   const path=`${directory}/execution-${width}.png`;await section.screenshot({path});captures.push(path);
  }catch(error){for(const page of context.pages())await page.screenshot({path:`${directory}/failure-${width}.png`,fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
 }
 return captures;
}
