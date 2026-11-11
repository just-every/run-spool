import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {receiver} from '../tests/alerts/receiver.mjs';
import {alertRuntime,event,setup} from '../tests/alerts/runtime.mjs';
import {launchBrowser} from '../tests/browser-launch.mjs';
const packet=resolve('../packet'),screens=resolve(packet,'screens');
await mkdir(screens,{recursive:true});
const temporary=await mkdtemp(resolve(tmpdir(),'spool-date-proof-')),inbox=await receiver(resolve(temporary,'receiver.sqlite'));
let app,browser;
const receipt={screens:[],pageErrors:[]};
try {
 app=await alertRuntime(inbox);
 const auth=await setup(app);
 await app.json('/api/ingest/web','POST',event('synthetic-spool-date-proof',{message:'Synthetic checkout confirmation missing',frames:[{file:'synthetic-checkout.js',line:12,column:0,function:'confirm'}]}),auth);
 const issue=(await app.json('/api/projects/web/issues'))[0];
 const received=Math.floor(Date.now()/300000)*300000-300000+100;
 await app.db.prepare('UPDATE events SET received=? WHERE project=?').bind(received,'web').run();
 const to=Math.ceil(Date.now()/60000)*60000,from=to-7*86400000;
 const saved=await app.json('/api/reporting/items','POST',{kind:'dashboard',name:'Synthetic checkout event volume',widgets:[{project:'web',name:'Received checkout events',config:{metric:'count',q:'',from,to}}]});
 browser=await launchBrowser();
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'UTC'});
  await context.addCookies(app.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:app.origin})));
  const page=await context.newPage();page.on('pageerror',e=>receipt.pageErrors.push(e.message));
  for(const [name,path,ready] of [
   ['issues','/projects/web/issues','main .issue-row'],
   ['issue-detail','/projects/web/issues/'+issue.id,'.metadata[data-event-id]'],
   ['reports','/projects/web/reports?item='+saved.id,'.reports-note'],
  ]){
   await page.goto(app.origin+path);
   if(name==='issues')await page.getByText('Synthetic checkout confirmation missing',{exact:false}).first().waitFor();
   else await page.locator(ready).first().waitFor();
   if(name==='reports'){
    await page.getByRole('region',{name:'Query table',exact:true}).locator('tbody tr').first().waitFor();
    await page.getByRole('region',{name:'Saved reports and dashboards',exact:true}).locator('article.reports-widget').first().waitFor();
   }
   const file='screens/'+name+'-'+width+'.png';await page.screenshot({path:resolve(packet,file),fullPage:true});
   receipt.screens.push({name,width,file,dateText:await page.locator(name==='reports'?'.reports-note':'.metadata').allTextContents()});
  }
  await page.goto(app.origin+'/projects/web/alerts');
  await page.getByRole('button',{name:'Rules',exact:true}).click();
  await page.getByLabel('Rule name',{exact:true}).fill('Synthetic checkout notifications');
  await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption('mail-v1');
  await page.getByRole('button',{name:'Preview rule',exact:true}).click();
  const preview=page.getByRole('region',{name:'Rule preview',exact:true});await preview.waitFor();
  const file='screens/alert-preview-'+width+'.png';await page.screenshot({path:resolve(packet,file),fullPage:true});
  receipt.screens.push({name:'alert-preview',width,file,dateText:await preview.innerText()});
  await context.close();
 }
 await writeFile(resolve(packet,'browser-proof.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log('Browser proof captured Issues, issue detail, Reports and Alerts Rules Preview at 1440 and 390; page errors='+receipt.pageErrors.length);
}finally{await browser?.close();await app?.close();await inbox.close();await rm(temporary,{recursive:true,force:true})}
