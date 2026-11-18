import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sentryDoorClient } from '../../scripts/sentry-import.mjs';
import { startTestWorker } from '../worker.mjs';
import { signIn } from '../auth.mjs';
import { archiveProjection } from '../archive.mjs';
import { followErasure } from '../project-erasure/follow.mjs';
import { launchBrowser } from '../browser-launch.mjs';

export async function alertRulesImport() {
 const bytes=await readFile(new URL('../fixtures/sentry/alert-rules.json',import.meta.url));
 const fixture=JSON.parse(bytes), app=await startTestWorker(15525);
 const {origin}=app, history='/api/imports/business', packet=process.env.SPOOL_ALERT_IMPORT_PACKET;
 let browser;
 try {
  const cookie=await signIn(origin);
  const request=(path,method='GET',body,headers={})=>fetch(origin+path,{method,headers:{
   Origin:origin,Cookie:cookie,Connection:'close',...body?{'Content-Type':'application/json'}:{},...headers,
  },...body?{body:JSON.stringify(body)}:{}});
  const json=async(...args)=>{
   const response=await request(...args);
   assert.ok(response.ok,`${args[1]??'GET'} ${args[0]}: ${response.status} ${await response.clone().text()}`);
   return response.json();
  };
  const client=organization=>sentryDoorClient({endpoint:origin,cookie,organization});
  const snapshot=async()=>archiveProjection(await request('/api/archive'));
  const before=(await snapshot()).data;
  async function apply(bundle){
   const door=client(bundle.organization.slug), data=Buffer.from(JSON.stringify(bundle));
   const planned=await door.plan(data);
   assert.ok((await door.apply(planned.planId,planned.fingerprint)).job.state==='completed');
   const project=(await door.status(planned.planId)).projectIds[0];
   return {door,planned,project,root:'/api/projects/'+project,approve:history+'/'+planned.planId+'/alert-rules'};
  }
  const noWrite=await client(fixture.organization.slug).plan(bytes);
  assert.deepEqual((await snapshot()).data,before,'review has no native side effects');
  assert.equal(noWrite.rejected.length,1,'a malformed rule is refused');
  assert.equal(noWrite.sentry.rules.items.filter(row=>row.state==='proposed').length,8);
  assert.equal((await client(fixture.organization.slug).call('undo',{planId:noWrite.planId})).state,'cancelled');
  const run=await apply(fixture), {door,planned,root,approve,project}=run;
  const facts=()=>door.status(planned.planId);
  const rules=()=>json(root+'/alerting/rules');
  assert.deepEqual(await rules(),[]);
  assert.deepEqual(await json(root+'/alerts'),[]);
  assert.equal((await facts()).sentry.rules.pending,8);
  assert.equal((await request(approve,'POST',{fingerprint:planned.fingerprint},{Cookie:''})).status,401);
  assert.equal((await request(approve,'POST',{fingerprint:planned.fingerprint},{Origin:'https://other.example.test'})).status,403);
  assert.equal((await request(approve,'POST',{fingerprint:'0'.repeat(64)})).status,409);

  if(packet){
   await mkdir(packet,{recursive:true});
   browser=await launchBrowser();
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   const split=cookie.indexOf('=');
   await context.addCookies([{name:cookie.slice(0,split),value:cookie.slice(split+1),url:origin.replace('http:','https:'),secure:true}]);
   const page=await context.newPage();
   await page.goto(origin+'/projects/'+project+'/settings#settings-data');
   await page.getByRole('button',{name:'Details: Business imports',exact:true}).click();
   const receipt=page.getByRole('dialog',{name:'Business imports',exact:true});
   const button=receipt.getByRole('button',{name:'Create these rules'});
   await button.waitFor();
   await button.click();
   await button.waitFor({state:'hidden'});
   for(const row of fixture.collections.filter(c=>c.kind!=='releases'&&['rules','metric_alerts','workflows'].includes(c.kind)).flatMap(c=>c.pages[0].response)){
    await receipt.getByText(row.name,{exact:true}).waitFor();
   }
   assert.ok(await receipt.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'receipt fits the reviewed desktop width');
   await page.screenshot({path:join(packet,'receipt-1440.png')});
   await page.setViewportSize({width:390,height:1000});
   await page.screenshot({path:join(packet,'receipt-390.png')});
   await browser.close();
   browser=null;
  } else await json(approve,'POST',{fingerprint:planned.fingerprint});

  const states=(await facts()).sentry.rules;
  const native=await rules(), byName=name=>native.find(rule=>rule.name===name);
  assert.equal(states.created,8);
  assert.equal(states.pending,0);
  assert.deepEqual(states.items.filter(row=>row.state==='waiting').map(row=>row.name).sort(),
   ['Synthetic crash-free sessions','Synthetic unique users']);
  assert.equal(byName('Synthetic Slack').enabled,0);
  assert.match(states.items.find(row=>row.name==='Synthetic Slack').status,/Slack/);
  assert.equal(byName('Synthetic unrepresentable aggregate').enabled,0);
  assert.ok(states.items.find(row=>row.name==='Synthetic unrepresentable aggregate').omissions.some(row=>row.path.endsWith('/aggregate')&&row.reason.includes('histogram')));
  assert.deepEqual(JSON.parse(byName('Synthetic error thresholds').config).triggers.map(t=>t.alertThreshold),[4,2]);
  assert.equal(JSON.parse(byName('Synthetic error thresholds').config).resolveThreshold,0);
  assert.deepEqual(await json(approve,'POST',{fingerprint:planned.fingerprint}),{created:8});
  assert.deepEqual(await rules(),native,'repeated approval preserves the native rules');
  assert.deepEqual(await json(root+'/alerting/deliveries'),[]);
  assert.deepEqual(await json(root+'/alerts'),[]);
  assert.ok((await json('/api/audit/export?format=json')).rows.some(row=>row.action==='import.apply'&&row.subject_kind==='import'&&row.source==='transaction'));
  assert.equal((await door.apply(planned.planId,planned.fingerprint)).job.state,'completed');

  const undoBundle=structuredClone(fixture);
  undoBundle.organization.slug='synthetic-alerts-undo';
  const undone=await apply(undoBundle);
  await json(undone.approve,'POST',{fingerprint:undone.planned.fingerprint});
  assert.equal((await undone.door.undo(undone.planned.planId)).job.state,'undone');
  assert.ok(!(await json('/api/projects')).some(p=>p.id===undone.project),'guarded undo removes both unchanged rules and their project');
  const edited=byName('Synthetic new issue');
  await json(root+'/alerting/rules/'+edited.id,'PUT',{revision:edited.revision,name:'Locally revised synthetic rule',enabled:false,
   channel:edited.channel,destination:edited.destination,kinds:JSON.parse(edited.kinds),windowMs:edited.window_ms,
   threshold:edited.threshold,config:JSON.parse(edited.config)});
  await assert.rejects(door.undo(planned.planId),error=>error.status===409&&error.code==='native_edit_conflict');
  assert.equal((await rules()).find(row=>row.id===edited.id).name,'Locally revised synthetic rule');

  const key=await json(root+'/keys','POST',{kind:'ingest'});
  await json(root+'/releases','POST',{name:'synthetic-v1',build:'synthetic-build'});
  const dsn=new URL(key.dsn);
  const send=async(type,body)=>{
   const response=await fetch(origin+'/api'+dsn.pathname+'/envelope/?sentry_version=7&sentry_key='+encodeURIComponent(dsn.username),{
    method:'POST',body:'{}\n'+JSON.stringify({type})+'\n'+JSON.stringify(body),headers:{Connection:'close'},
   });
   assert.equal(response.status,200,await response.clone().text());
   return response.json();
  };
  const now=Date.now(), end=(Math.floor(now/60000)+1)*60000;
  const tick=async(time)=>{const response=await app.scheduled(time);assert.equal(response.status,200);assert.equal((await response.json()).outcome,'ok');};
  await tick(now);
  assert.equal((await facts()).sentry.rules.items.filter(row=>row.state==='waiting').length,2,'quiet scheduling leaves the rules waiting');
  const event=(environment,client)=>json('/api/ingest/'+project,'POST',{
   version:1,eventId:crypto.randomUUID(),release:'synthetic-v1',build:'synthetic-build',environment,type:'Error',
   message:'Synthetic import alert observation',frames:[{file:'src/synthetic.js',line:1,column:0,function:'synthetic'}],...client?{client}:{},
  },{Authorization:'Bearer '+key.key});
  await event('nonmatching','synthetic-client-one');
  await tick(Date.now());
  assert.equal((await facts()).sentry.rules.items.filter(row=>row.state==='waiting').length,2,'an event outside the filter does not activate a rule');
  await event('production','synthetic-client-two');
  const stamp=new Date().toISOString();
  await send('session',{sid:crypto.randomUUID().replaceAll('-',''),started:stamp,timestamp:stamp,status:'crashed',errors:1,
   attrs:{release:'synthetic-v1',environment:'production'}});
  await tick(end);
  const after=await rules(), activated=after.filter(row=>['Synthetic crash-free sessions','Synthetic unique users'].includes(row.name));
  assert.ok(activated.every(row=>row.enabled===1&&row.revision===1),'matching evidence activates both existing rules without a new revision');
  const feed=await json(root+'/alerts');
  assert.equal(feed.filter(row=>row.kind==='metric'&&JSON.parse(row.payload).rule.id===byName('Synthetic crash-free sessions').id).length,1);
  await app.restart();
  await tick(end);
  assert.deepEqual(await json(root+'/alerts'),feed,'a restarted Worker does not duplicate alert evaluation');
  assert.deepEqual(await json(root+'/alerting/deliveries'),[],'new local observations do not send to an unbound destination');

  const archive=await snapshot();
  assert.ok(archive.data.alert_rules.filter(row=>row.project===project).every(row=>row.enabled===0),'portable rules are inert');
  const preview=await json(root+'/erasure');
  const start=await json(root+'/erasure','POST',{confirm:project,planHash:preview.planHash});
  const erased=await followErasure((path,method)=>json(path,method),start);
  assert.equal(erased.phase,'complete');
  assert.ok(!(await snapshot()).data.spool_import_proposals.some(row=>row.project===project));
  assert.ok(!(await snapshot()).data.alert_rules.some(row=>row.project===project));
  if(packet)await writeFile(join(packet,'ALERT-IMPORT-RECEIPT.json'),JSON.stringify({
   synthetic:true,at:new Date().toISOString(),sourceDefinitions:states.sourceDefinitions,proposals:8,created:states.created,
   refused:states.notImported,waiting:activated.length,alertsAfterObservation:feed.length,deliveries:0,erasure:erased.phase,
  },null,2)+'\n');
  console.log('Sentry alert import: public proposal, approval, wait, restart, native-edit undo refusal and erasure journey passed.');
 } finally {
  await browser?.close();
  await app.stop();
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await alertRulesImport();
