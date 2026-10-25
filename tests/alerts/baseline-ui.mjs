import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {nativeAlertRuntime} from './native-runtime.mjs';
import {baselineJourney} from './baseline-journey.mjs';

export async function baselineUI(browser){
 const app=await nativeAlertRuntime();
 try{
  await baselineJourney(app);
  await mkdir('.artifacts/alerts',{recursive:true});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900}});
   try{
    await context.addCookies(app.cookie.split('; ').map(cookie=>{const at=cookie.indexOf('=');return {name:cookie.slice(0,at),value:cookie.slice(at+1),url:app.origin}}));
    const page=await context.newPage();
    for(const name of ['normal','burst']){
     const project='synthetic-spool-34-'+name,issues=await app.json(`/api/projects/${project}/issues`);
     const issue=issues.find(row=>row.title.includes('Synthetic baseline target'));assert.ok(issue,'the baseline screen uses its publicly captured target issue');
     const rows=await app.json(`/api/projects/${project}/alerting/decisions`),target=rows.find(row=>row.issue===issue.id&&JSON.parse(row.reason).count===(name==='normal'?2:6));
     assert.ok(target,'the target issue has its completed-window decision');const reason=JSON.parse(target.reason);
     assert.equal(reason.fired,name==='burst','normal target is withheld and burst target fires');
     await page.goto(`${app.origin}/projects/${project}/alerts`);
     await page.getByRole('button',{name:'Rules',exact:true}).click();
     const recorded=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Recorded window decisions/})});
     await recorded.locator(':scope > summary').click();
     const sample=recorded.locator(':scope > section').filter({hasText:target.issue});
     await sample.locator('details > summary').filter({hasText:/^Window decisions/}).click();
     const text=await sample.innerText();
     assert.ok(text.includes(reason.reason),'the stored baseline decision reason is visible');
     assert.ok(text.includes(String(reason.baseline))&&text.includes(String(reason.threshold)),'the stored baseline and threshold are visible');
     assert.ok(text.includes(reason.fired?'Fired':'Withheld'),'the stored fired or withheld state is visible');
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
     await sample.screenshot({path:`.artifacts/alerts/baseline-${name}-${width}.png`});
    }
   }finally{await context.close()}
  }
 }finally{await app.close()}
}
