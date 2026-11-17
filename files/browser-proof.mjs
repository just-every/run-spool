import assert from 'node:assert/strict';
import {chromium} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/node_modules/@playwright/test/index.mjs';
import {nativeAlertRuntime} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/tests/alerts/native-runtime.mjs';
import {waitingData} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/tests/alerts/waiting-data.mjs';
import {workbenchLink} from '/home/agent/rer-consolidation/work/sd-spool-import-rules-1/run-spool/tests/navigation.mjs';
import {writeFile} from 'node:fs/promises';
const output='/home/agent/rer-consolidation/work/sd-spool-import-rules-1/packet',app=await nativeAlertRuntime();let browser;const evidence=[];
try{
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});
 await waitingData(app,{proof:async(stage,project,rules)=>{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}});
   try{
    await context.addCookies(app.cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return {name:pair.slice(0,i),value:pair.slice(i+1),url:app.origin}}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
    await page.goto(app.origin);await page.getByRole('combobox',{name:'Project',exact:true}).selectOption(project.id);
    await (await workbenchLink(page,'Alerts')).click();await page.getByRole('button',{name:'Rules',exact:true}).click();
    await page.getByRole('button',{name:'Edit '+rules[0].name,exact:true}).waitFor();
    if(width===1440){
     for(const rule of rules){const row=page.locator('.alert-rules > .alert-records > li').filter({has:page.getByText(rule.name,{exact:true})});await row.waitFor();if(rule.waitingReason)assert.ok((await row.innerText()).includes(rule.waitingReason),'owner sees the live waiting reason alongside the saved on rule');}
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'rules fit the desktop viewport');assert.deepEqual(errors,[]);
    }
    if(stage==='waiting'){
     await page.getByRole('button',{name:'Edit '+rules[0].name,exact:true}).click();
     const reply=page.waitForResponse(response=>response.url().endsWith('/rules/preview')&&response.request().method()==='POST');
     await page.getByRole('button',{name:'Preview rule',exact:true}).click();const preview=await (await reply).json();
     await page.getByRole('region',{name:'Rule preview',exact:true}).getByRole('status').waitFor();
     if(width===1440){assert.ok(preview.token);assert.equal(preview.refusal,null);assert.ok(await page.getByRole('button',{name:'Save rule',exact:true}).isEnabled(),'the waiting preview enables owner save without a test event');}
    }
    const file=`rules-${stage}-${width}.png`;await page.screenshot({path:output+'/'+file,fullPage:true});evidence.push({stage,width,file,enabled:rules.map(r=>r.enabled),waitingFor:rules.map(r=>r.waitingFor),assertions:width===1440});
   }finally{await context.close()}
  }
 }});
 await writeFile(output+'/browser-receipt.json',JSON.stringify({schema:1,browser:'system Chromium',screens:evidence},null,2)+'\n');console.log('Built owner rules shown once per state at 1440 and 390; desktop live-state assertions passed.');
}finally{await browser?.close();await app.close()}
