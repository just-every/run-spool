import {alertRuntime,setup,event} from '../tests/alerts/runtime.mjs';
import {receiver} from '../tests/alerts/receiver.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
import {usageLabels} from '../tests/team-browser.mjs';
const inbox=await receiver('/tmp/spool-readable-usage.sqlite');let app,browser;
try {
 app=await alertRuntime(inbox);const auth=await setup(app);await app.json('/api/ingest/web','POST',event('synthetic-spool-initial'),auth);await app.json('/api/ingest/web','POST',event('synthetic-spool-initial'),auth);browser=await launchBrowser();const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addCookies([{name:app.cookie.split('=')[0],value:app.cookie.split('=')[1],url:app.origin}]);const page=await ctx.newPage();
 await page.goto(app.origin+'/projects/web/settings');await page.getByRole('region',{name:'Members',exact:true}).locator('.data-row').filter({hasText:'Web app · Events received'}).waitFor({state:'attached'});
 await usageLabels(page,{origin:app.origin,json:app.json,req:app.request},{id:'web',name:'Web app'});console.log('Organization usage: real environment-filtered capture counted; labels contain no internal reason codes; screenshots at 1440/390.');
}finally{await browser?.close();await app?.close();await inbox.close();}
