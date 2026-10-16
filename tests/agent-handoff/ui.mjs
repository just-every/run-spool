import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import {openGate} from '../auth.mjs';
export async function handoffPanel(browser,app,directory){
 const captures=[];
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  try{
   await openGate(context,app.origin);
   const pairs=app.cookie.split('; ').filter(Boolean);await context.addCookies(pairs.map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
   const page=await context.newPage();await page.goto(app.origin+'/projects/a/settings');
   const minted=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/projects/a/keys'&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Create read-only agent key',exact:true}).click();const grant=await (await minted).json();
   const panel=page.locator('.agent-handoff');await panel.waitFor();const setup=await panel.locator('pre').first().innerText();assert.ok(!setup.includes(grant.key));assert.ok(setup.includes(app.origin+'/api/projects/a'));assert.ok(await panel.locator('[data-secret="agent-key"]').innerText()===grant.key,'once-shown key retained');
   await context.grantPermissions(['clipboard-read','clipboard-write']);await panel.getByRole('button',{name:'Copy setup lines',exact:true}).click();assert.ok(await page.evaluate(()=>navigator.clipboard.readText())===setup,'copied setup contains only the displayed commands');await panel.getByRole('button',{name:'Copy agent key',exact:true}).click();assert.ok(await page.evaluate(()=>navigator.clipboard.readText())===grant.key,'key can be copied separately');await page.evaluate(()=>navigator.clipboard.writeText(''));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(audit.violations.map(row=>row.id),[]);
   const path=directory+'/agent-handoff-'+width+'.png';await page.screenshot({path,fullPage:true,mask:[page.locator('[data-secret]')]});captures.push(path);
   await page.reload();await page.getByRole('button',{name:'Create read-only agent key',exact:true}).waitFor();assert.equal(await page.locator('.agent-handoff').count(),0);assert.ok(!(await page.locator('body').innerText()).includes(grant.key));
  }finally{await context.close();}
 }
 return captures;
}
