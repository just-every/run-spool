import assert from 'node:assert/strict';
import {startTestWorker} from './worker.mjs';
import {browserSignIn,signIn} from './auth.mjs';
import {launchBrowser} from './browser-launch.mjs';

// The sole phone-width registration: sign in, open the mobile navigation, and
// follow a captured failure from the inbox to its readable source evidence.
const app=await startTestWorker(15579);let browser;
try {
 const cookie=await signIn(app.origin);
 const json=async(path,method='GET',body)=>{const r=await fetch(app.origin+path,{method,headers:{Origin:app.origin,Cookie:cookie,'Content-Type':'application/json'},...body?{body:JSON.stringify(body)}:{}});assert.ok(r.ok);return r.json()};
 const project=await json('/api/projects','POST',{id:'phone',name:'Phone checkout'});
 await json('/api/projects/phone/releases','POST',{name:'checkout@1',build:'b1'});
 const event=await fetch(app.origin+'/api/ingest/phone',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+project.ingestKey},body:JSON.stringify({version:1,eventId:'phone-error',release:'checkout@1',build:'b1',environment:'production',type:'TypeError',message:'Phone checkout failed',frames:[{file:'checkout.js',line:8,column:0,function:'checkout'}],breadcrumbs:[]})});assert.equal(event.status,201);
 browser=await launchBrowser();const page=await browser.newPage({viewport:{width:390,height:844}});await browserSignIn(page,app.origin);
 await page.goto(app.origin+'/projects/phone/issues');await page.getByRole('button',{name:/^Menu/}).click();await page.getByRole('navigation').first().waitFor();await page.getByRole('button',{name:/^Menu/}).click();
 await page.locator('tbody tr').first().getByRole('link').click();await page.getByRole('heading',{name:'Stack trace',exact:true}).waitFor();
 await page.getByRole('heading',{name:'TypeError: Phone checkout failed',exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 console.log('Phone smoke passed: owner, mobile navigation, captured issue and source evidence.');
}finally{await browser?.close();await app.stop()}
