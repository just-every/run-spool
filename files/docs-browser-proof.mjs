import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {startTestWorker} from '../tests/worker.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
const packet=process.env.HOME+'/rer-consolidation/work/main-spool-capture-setup-truth-1/packet',app=await startTestWorker(15592);let browser;
try{
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),screens=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const slug of ['capture','framework-setup']){
  const response=await page.goto(app.origin+'/docs/'+slug);assert.equal(response.status(),200);assert.ok(await page.locator('a[href="https://nodejs.org/en/download"]').count(),'published SDK instructions link their prerequisite');
  if(slug==='capture')assert.equal(await page.locator('#browser-capture-without-nodejs-or-npm').count(),1,'the documented no-Node fragment reaches the helper setup');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);await page.screenshot({path:packet+`/after-docs-${slug}-${width}.png`,fullPage:true});screens.push({screen:'docs-'+slug,width,overflow})}
 }
 assert.deepEqual(errors,[]);await writeFile(packet+'/docs-browser-receipt.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),screens,pageErrors:errors},null,2)+'\n');console.log(JSON.stringify({screens,pageErrors:errors}));
}finally{await browser?.close();await app.stop()}
