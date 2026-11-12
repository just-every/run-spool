import assert from 'node:assert/strict';
import {startTestWorker} from '../tests/worker.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
const out='/home/agent/rer-consolidation/work/main-spool-setup-links-1/packet';
const worker=await startTestWorker(15585);let browser;
try{
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:900},javaScriptEnabled:false});const page=await context.newPage();
 for(const slug of ['user-identity','github-connection','integration-egress','business-import-trust']){
  const response=await page.goto(worker.origin+'/docs/'+slug);assert.equal(response.status(),200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,slug+' fits desktop');await page.screenshot({path:`${out}/${slug}-docs-1440.png`,fullPage:true});await page.setViewportSize({width:390,height:900});await page.screenshot({path:`${out}/${slug}-docs-390.png`,fullPage:true});console.log(slug+': '+await page.evaluate(()=>JSON.stringify({viewport:innerWidth,content:document.documentElement.scrollWidth})));await page.setViewportSize({width:1440,height:900});
 }await context.close();
}finally{await browser?.close();await worker.stop()}
