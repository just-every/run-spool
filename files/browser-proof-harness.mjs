import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {startTestWorker} from '/workspace/run-spool/tests/worker.mjs';
import {signIn} from '/workspace/run-spool/tests/auth.mjs';
import {launchBrowser} from '/workspace/run-spool/tests/browser-launch.mjs';
const output=process.env.HOME+'/rer-consolidation/work/main-spool-dashboard-window-1/packet';
const worker=await startTestWorker(15591);let browser;
try{
 const cookie=await signIn(worker.origin),origin=worker.origin;
 const req=(path,method='GET',body)=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const project=await req('/api/projects','POST',{id:'synthetic-spool-1',name:'Synthetic delivery'});assert.equal(project.status,201);
 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));
 const page=await context.newPage();await page.goto(origin+'/projects/synthetic-spool-1/settings#reports-configuration-title');
 const region=page.getByRole('region',{name:'Reports, dashboards and query tables',exact:true});
 await region.getByLabel('View name',{exact:true}).fill('Delivery overview');
 const date=n=>new Date(n).toISOString().slice(0,16),now=Date.now(),widgets=region.locator('.reports-widget');
 for(let n=0;n<2;n++){await widgets.nth(n).getByLabel('Window start (UTC)',{exact:true}).fill(date(now-3600000));await widgets.nth(n).getByLabel('Window end (UTC)',{exact:true}).fill(date(now+3600000));}
 const before=process.argv.includes('--before');
 await region.getByRole('button',{name:'Save dashboard',exact:true}).click();
 await region.getByRole('alert').first().waitFor();
 const error=await region.getByRole('alert').allTextContents();
 assert.match(error.join(' '),before?/90 days/:/end.*future/i);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await region.scrollIntoViewIfNeeded();await region.screenshot({path:output+`/${before?'before':'after'}-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
 const rows=await(await req('/api/reporting/items')).json();assert.equal(rows.items.length,0);
 await writeFile(output+`/${before?'before':'after'}-receipt.json`,JSON.stringify({sourceHead:process.env.PROOF_HEAD,refusal:error,savedItems:rows.items.length,widths:[1440,390]},null,2)+'\n');
 console.log(JSON.stringify({phase:before?'before':'after',refusal:error,savedItems:rows.items.length}));
}finally{await browser?.close();await worker.stop();}
