import assert from 'node:assert/strict';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { hash } from '../src/domain/privacy.ts';

export async function loaderUpgrade({browser, applicationOrigin, dsns, defaults}) {
 let worker, context;
 try {
  worker=await startTestWorker(15524,{}, {beforeMigration:'0061_loader_settings.sql'});
  const {origin}=worker, cookie=await signIn(origin);
  const request=async(path,method='GET',body)=>{
   const response=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},...body?{body:JSON.stringify(body)}:{}});
   assert.ok(response.ok,`${method} ${path}: ${response.status}`);return response.json();
  };
  const project=await request('/api/projects','POST',{id:'synthetic-spool-upgrade',name:'Existing checkout project'}),key=new URL(project.dsn).username;
  await request(`/api/projects/${project.id}/browser-origins`,'POST',{origin:applicationOrigin});
  const beforeKeys=await request(`/api/projects/${project.id}/keys`);
  dsns.loader={key,project,origin}; context=await browser.newContext();const page=await context.newPage();
  await page.goto(applicationOrigin+'/loader?mode=direct');
  await page.waitForFunction(()=>window.Sentry.getClient?.());
  await page.getByRole('button',{name:'Capture checkout error',exact:true}).click();await page.evaluate(()=>Sentry.flush(10000));
  const [issue]=await request(`/api/projects/${project.id}/issues`);assert.equal(issue.count,1,'the existing key captures before the additive upgrade');
  await worker.migrate('0061_loader_settings.sql');
  assert.deepEqual(await request(`/api/projects/${project.id}/keys`),beforeKeys,'the populated upgrade preserves existing capture keys');
  const snapshot=await request(`/api/projects/${project.id}/keys/${await hash(key)}/loader`);
  assert.deepEqual(snapshot.settings,defaults,'existing keys acquire the same conservative defaults as new keys');
  const bundles=[];page.on('request',req=>{if(new URL(req.url()).pathname==='/spool-sentry-sdk.js')bundles.push(req.url())});
  await page.goto(applicationOrigin+'/loader?mode=lazy');assert.equal(bundles.length,0);
  await page.getByRole('button',{name:'Capture checkout error',exact:true}).click();await page.waitForFunction(()=>window.Sentry.getClient?.());await page.evaluate(()=>Sentry.flush(10000));
  const [after]=await request(`/api/projects/${project.id}/issues`);
  assert.equal(after.id,issue.id);assert.equal(after.count,2,'the same pre-upgrade key delivers exactly one loader occurrence after upgrade');
  console.log('SDK-023 populated upgrade: existing project, key and occurrence preserved; same key defaults lazy and captures once after migration0061');
 } finally {await context?.close();await worker?.stop();}
}
