import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startTestWorker } from './worker.mjs';
import { freePort } from './admission-runtime.mjs';
import { signIn, openGate } from './auth.mjs';
import { launchBrowser } from './browser-launch.mjs';
import { archiveProjection } from './archive.mjs';
import { bugsnagImportCli, bugsnagDoorClient } from '../scripts/bugsnag-import.mjs';
import { bugsnagFixture } from './fixtures/bugsnag/organization.mjs';
import { bugsnagCutover } from './bugsnag-cutover.mjs';

/** One public migration journey: reviewed history, recovery, cutover and erasure. */
export async function bugsnagMigrationFlow(){
 const worker=await startTestWorker(await freePort()),{origin}=worker;
 const scratch=await mkdtemp(join(tmpdir(),'spool-bugsnag-'));let browser;
 try{
  let cookie=await signIn(origin);
  const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,Connection:'close',...value?{'Content-Type':'application/json'}:{},...headers},...value?{body:typeof value==='string'?value:JSON.stringify(value)}:{}});
  const json=async(path,method,value,headers)=>{const response=await req(path,method,value,headers);assert.ok(response.ok,`${path}: ${response.status} ${response.ok?'':await response.text()}`);return response.json()};
  const cli=(action,...args)=>{process.env.SPOOL_BUGSNAG_TEST_SESSION=cookie;return bugsnagImportCli([action,'--endpoint',origin,'--session-env','SPOOL_BUGSNAG_TEST_SESSION',...args])};
  const bundle=bugsnagFixture(),file=join(scratch,'organization.json');await writeFile(file,JSON.stringify(bundle));
  const before=await archiveProjection(await req('/api/archive'));
  const plan=await cli('dry-run','--file',file);
  assert.equal(plan.namespace,'bugsnag-org:synthetic-spool-1');assert.equal(plan.counts.duplicates,1);assert.equal(plan.counts.rejected,0);
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,before.data,'preview creates no native graph, sessions, grants or outbound work');
  assert.equal(plan.bugsnag.projects.find(p=>p.sourceId==='web').sampledEvents,1);
  assert.equal(plan.bugsnag.projects.find(p=>p.sourceId==='android').sampledEvents,1);
  const webRelease=plan.bugsnag.projects.find(p=>p.sourceId==='web').releases.find(r=>r.sourceId==='web-release');
  assert.equal(webRelease.stage,'production');console.log('PROBE MIG-004 A1: release_stage object -> accepted; mapped production');assert.equal(webRelease.totalSessions,1000);assert.equal(webRelease.unhandledSessions,7);assert.equal(webRelease.denominatorStatus,'source_aggregate_only');assert.equal(webRelease.crashFreeRate,null);
  for(const release of plan.bugsnag.projects.flatMap(p=>p.releases).filter(r=>r.sourceId!=='web-release')){assert.equal(release.denominatorStatus,'historical_sessions_unavailable');assert.equal(release.crashFreeRate,null);assert.ok(release.reason);}
  assert.ok(plan.bugsnag.losses.some(row=>row.kind==='collaborators'));assert.ok(plan.bugsnag.losses.some(row=>row.kind==='integrations'));assert.ok(plan.bugsnag.losses.some(row=>row.field==='unthrottled_occurrence_count'));
  const client=bugsnagDoorClient({endpoint:origin,cookie,organization:bundle.organization.id});
  const args=['--organization',bundle.organization.id,'--plan',plan.planId,'--fingerprint',plan.fingerprint];
  await assert.rejects(cli('apply',...args.slice(0,-1),'0'.repeat(64)),error=>error.status===403);
  const interrupted=await client.call('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint});
  assert.equal(interrupted.job.state,'applying');assert.ok(interrupted.job.checkpoint>0&&interrupted.job.checkpoint<interrupted.job.total,'first bounded apply leaves a real durable checkpoint');
  cookie=await signIn(origin,{bootstrap:false});
  const applied=await cli('resume',...args);assert.equal(applied.job.id,interrupted.job.id);assert.equal(applied.job.state,'completed');
  assert.equal((await cli('apply',...args)).job.id,applied.job.id,'replay is the same durable job');
  const report=await cli('reconcile','--organization',bundle.organization.id,'--plan',plan.planId);
  assert.equal(report.ok,true);assert.deepEqual(report.counts.byKind,{project:2,release:3,issue:2,event:2});
  assert.deepEqual(report.bugsnag,plan.bugsnag,'reconcile retains separate reviewed source denominators and conversion losses');
  const projects=await json('/api/projects'),web=projects.find(p=>p.name==='Cedar web shop'),android=projects.find(p=>p.name==='Cedar Android shop');assert.ok(web&&android);
  const importedIssues=[];
  for(const project of [web,android]){
   assert.deepEqual(await json(`/api/projects/${project.id}/keys`),[]);assert.deepEqual(await json(`/api/projects/${project.id}/alerts`),[]);
   const issues=await json(`/api/projects/${project.id}/issues`);assert.equal(issues.length,1);assert.equal(issues[0].count,1,'source aggregate event count is never fabricated as occurrences');
   assert.equal(issues[0].state,project===web?'resolved':'open');
   const packet=await json(`/api/projects/${project.id}/issues/${issues[0].id}/packet`);assert.equal(packet.events.length,1);assert.equal(packet.events[0].historical,true);assert.ok(!JSON.stringify(packet).includes('not projected'));
   const imported=packet.events[0],mobile=project===android;
   assert.equal(imported.event.release,mobile?'1.0.0@production+42':'1.0.0@production+unspecified');
   assert.equal(imported.event.environment,'production');
   assert.deepEqual(imported.event.frames,[mobile?
    {file:'CheckoutActivity.kt',line:43,column:null,function:'com.synthetic.CheckoutActivity.submit'}:
    {file:'https://shop.example/checkout.js',line:1,column:0,function:'submit'}]);
   assert.equal(imported.event.type,'CheckoutError');
   console.log('PROBE MIG-004 A2: snake_case coordinates -> '+JSON.stringify(imported.event.frames));
   assert.deepEqual(imported.currentLookup,[{generated:imported.event.frames[0],status:'imported_symbolicated_stack',source:'bugsnag-api-export'}]);
   importedIssues.push({project,issue:issues[0],packet});
  }
  assert.equal(importedIssues[1].packet.events[0].event.sentry.exceptions[0].stacktrace.frames[0].function,'com.synthetic.CheckoutActivity.submit');
  const archive=await archiveProjection(await req('/api/archive'));
  assert.equal(archive.data.health_sessions.length,0);assert.equal(archive.data.health_aggregates.length,0);assert.equal(archive.data.alerts.length,0);
  for(const kind of ['ingest','deploy','agent']){
   const native=await json('/api/projects','POST',{id:'refusal-'+kind,name:'Authority boundary'}),grant=await json(`/api/projects/${native.id}/keys`,'POST',{kind});
   const denied=await req('/api/operator/import/status','POST',{planId:plan.planId},{Cookie:'',Authorization:`Bearer ${grant.key}`,'X-Import-Source':plan.namespace});assert.ok([401,403].includes(denied.status));assert.deepEqual(Object.keys(await denied.json()),['error']);
  }
  assert.equal((await req('/api/operator/import/undo','POST',{planId:plan.planId},{Origin:'https://foreign.example','X-Import-Source':plan.namespace})).status,401);
  const nativeCutover=await bugsnagCutover({json,req,origin,web,android});
  const cutoverArchive=await archiveProjection(await req('/api/archive'));assert.equal(cutoverArchive.data.native_symbols.length,1);
  // Restore transports retained native history and private symbols, never credentials.
  const restored=await startTestWorker(await freePort());
  try{
   const restoredCookie=await signIn(restored.origin);
   const response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'X-Confirm-Restore':'yes','Content-Type':'application/x-ndjson'},body:cutoverArchive.text});assert.equal(response.status,200,await response.text());
   const after=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}));assert.deepEqual(after.data,cutoverArchive.data);
   const restoredPacket=await (await fetch(`${restored.origin}/api/projects/${android.id}/issues/${nativeCutover.issue}/packet`,{headers:{Cookie:restoredCookie}})).json();assert.equal(restoredPacket.events[0].currentLookup[0].original.function,'com.synthetic.MainActivity.crash');
  }finally{await restored.stop()}
  browser=await launchBrowser();const context=await browser.newContext();await openGate(context,origin);
  await context.addCookies(cookie.split('; ').map(part=>({name:part.slice(0,part.indexOf('=')),value:part.slice(part.indexOf('=')+1),url:origin})));
  const page=await context.newPage();await mkdir('.artifacts/bugsnag',{recursive:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   for(const [name,project,issue,expected] of [['imported-android',android.id,importedIssues[1].issue.id,'com.synthetic.CheckoutActivity.submit'],['native-cutover',android.id,nativeCutover.issue,'com.synthetic.MainActivity.crash']]){
    await page.goto(`${origin}/projects/${project}/issues/${issue}`);await page.getByText(expected,{exact:true}).first().waitFor();
    await page.screenshot({path:`.artifacts/bugsnag/${name}-${width}.png`,fullPage:true});
    const overflow=await page.locator('body *').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${name} at ${width} fits viewport: ${JSON.stringify(overflow)}`);
   }
  }
  await browser.close();browser=null;
  // Guarded undo refuses a live edited imported issue, then restores safe history only.
  const issue=importedIssues[0].issue;await json(`/api/projects/${web.id}/issues/${issue.id}`,'PATCH',{state:'open',revision:issue.revision});
  await assert.rejects(cli('undo','--organization',bundle.organization.id,'--plan',plan.planId),error=>error.status===409);
  assert.equal((await json(`/api/projects/${web.id}/issues`)).find(r=>r.id===issue.id).state,'open');
  // Erasing one project withdraws the complete shared raw bundle, and fences its replay.
  const preview=await json(`/api/projects/${android.id}/erasure`);let erased=await json(`/api/projects/${android.id}/erasure`,'POST',{confirm:android.id,planHash:preview.planHash});
  for(let step=0;erased.phase!=='complete'&&step<30;step++)erased=await json(`/api/erasures/${erased.id}/resume`,'POST');assert.equal(erased.phase,'complete');
  const remaining=await archiveProjection(await req('/api/archive'));assert.ok(!remaining.data.projects.some(p=>p.id===android.id));assert.equal(remaining.data.native_symbols.length,0,'project erasure removes native symbol bytes');
  await assert.rejects(cli('status','--organization',bundle.organization.id,'--plan',plan.planId),error=>[404,410].includes(error.status));
  await assert.rejects(cli('dry-run','--file',file),error=>error.status===409&&error.code==='source_erased','erased source is refused before a replay plan can exist');
  assert.ok(!(await json('/api/projects')).some(p=>p.id===android.id),'erased native history cannot be resurrected by replay');
  await req('/auth/signout','POST',{});await assert.rejects(cli('status','--organization',bundle.organization.id,'--plan',plan.planId),error=>error.status===401);
  await bugsnagDocumentedShapes();
  console.log('PROBE MIG-004 1: owner CLI web and Android export -> sampled graph and release session aggregates reconcile; interrupted apply resumes, history stays inert, archive restores and erasure fences replay.');
  console.log('PROBE MIG-004 2: deploy upload and public capture -> web map and Android original native stack, at 1440 and 390.');
  console.log('PROBE MIG-004 3: owner CLI missing and zero historical denominators -> explicit unavailable gap, crashFreeRate null and no fabricated sessions.');
 }finally{await browser?.close();await worker.stop();await rm(scratch,{recursive:true,force:true});delete process.env.SPOOL_BUGSNAG_TEST_SESSION}
}


/** Documented API shapes are exercised through the same owner import and read doors. */
export async function bugsnagDocumentedShapes(){
 const worker=await startTestWorker(await freePort()),{origin}=worker;
 const scratch=await mkdtemp(join(tmpdir(),'spool-bugsnag-shapes-'));
 try{
  const cookie=await signIn(origin),bundle=bugsnagFixture();
  const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,Connection:'close',...value?{'Content-Type':'application/json'}:{},...headers},...value?{body:JSON.stringify(value)}:{}});
  const json=async(path,method,value,headers)=>{const response=await req(path,method,value,headers);assert.ok(response.ok,await response.clone().text());return response.json()};
  const rows=(kind,project)=>bundle.collections.find(c=>c.kind===kind&&c.project===project).pages[0].response;
  const web=rows('events','web');
  for(const event of web){
   event.exceptions[0].errorClass=event.exceptions[0].error_class;delete event.exceptions[0].error_class;
   event.exceptions[0].stacktrace[0].column_number='0';
  }
  const mobile=rows('events','android'),second=structuredClone(mobile[0]);second.id+='-second';mobile.push(second);
  const iosProject={...structuredClone(rows('projects',null)[1]),id:'ios',name:'Cedar iOS shop',type:'ios'};
  rows('projects',null).push(iosProject);
  const iosRelease={...structuredClone(rows('releases','android')[0]),id:'ios-release',project_id:'ios',app_bundle_version:'84'};delete iosRelease.app_version_code;
  const iosError={...structuredClone(rows('errors','android')[0]),id:'ios-error',project_id:'ios'};
  const iosEvent={...structuredClone(mobile[0]),id:'ios-event',project_id:'ios',error_id:'ios-error',app:{version:'1.0.0',releaseStage:'production',type:'ios',bundleVersion:'84'}};
  iosEvent.exceptions=[{errorClass:'CheckoutError',message:'Checkout failed',stacktrace:[{file:'CheckoutController.swift',method:'CheckoutController.submit',line_number:43,column_number:'0',in_project:true}]}];
  for(const [kind,response] of [['releases',[iosRelease]],['errors',[iosError]],['events',[iosEvent]]])bundle.collections.push({kind,project:'ios',pages:[{cursor:null,nextCursor:null,response}]});
  const point={bucket_start:'2026-06-01T00:00:00Z',bucket_end:'2026-06-02T00:00:00Z',total_sessions_count:1000,unhandled_sessions_count:7,users_seen:800,users_with_unhandled:6};
  const stability={project_id:'web',release_stage_name:'production',timeline_points:[point]};
  bundle.collections.push({kind:'stability',project:'web',pages:[{cursor:null,nextCursor:null,response:stability}]});
  const file=join(scratch,'documented.json');await writeFile(file,JSON.stringify(bundle));
  process.env.SPOOL_BUGSNAG_SHAPES_SESSION=cookie;
  const cli=(action,...args)=>bugsnagImportCli([action,'--endpoint',origin,'--session-env','SPOOL_BUGSNAG_SHAPES_SESSION',...args]);
  console.log('PROBE MIG-004 shapes: reviewing documented API bundle');
  const plan=await cli('dry-run','--file',file);assert.equal(plan.counts.rejected,0);assert.equal(plan.counts.duplicates,1);
  const summary=plan.bugsnag.projects.find(p=>p.sourceId==='web').stability;
  assert.equal(summary.length,1);assert.equal(summary[0].stage,'production');
  assert.deepEqual(summary[0].timeline,[{start:point.bucket_start,end:point.bucket_end,totalSessions:1000,unhandledSessions:7,crashFreeRate:null,denominatorStatus:'source_aggregate_only'}]);
  const applied=await cli('apply','--organization',bundle.organization.id,'--plan',plan.planId,'--fingerprint',plan.fingerprint);assert.equal(applied.job.state,'completed');
  const report=await cli('reconcile','--organization',bundle.organization.id,'--plan',plan.planId);assert.equal(report.ok,true);
  assert.deepEqual(report.counts.byKind,{project:3,release:4,issue:3,event:4});assert.deepEqual(report.bugsnag,plan.bugsnag);
  const projects=await json('/api/projects'),archive=await archiveProjection(await req('/api/archive'));
  for(const [name,count,build,fileName] of [['Cedar web shop',1,'unspecified','https://shop.example/checkout.js'],['Cedar Android shop',2,'42','CheckoutActivity.kt'],['Cedar iOS shop',1,'84','CheckoutController.swift']]){
   const project=projects.find(p=>p.name===name);assert.ok(project);
   const issues=await json(`/api/projects/${project.id}/issues`);assert.equal(issues.length,1);assert.equal(issues[0].count,count);
   const packet=await json(`/api/projects/${project.id}/issues/${issues[0].id}/packet`);assert.equal(packet.events.length,count);
   for(const {event} of packet.events){assert.equal(event.environment,'production');assert.equal(event.release,`1.0.0@production+${build}`);assert.equal(event.build,build);assert.equal(event.type,'CheckoutError');assert.equal(event.frames.length,1);assert.equal(event.frames[0].file,fileName);if(build!=='42')assert.equal(event.frames[0].column,0);}
   assert.equal(archive.data.events.filter(e=>e.project===project.id&&e.release===`1.0.0@production+${build}`).length,count,'public archive agrees with native issue/packet and reconciliation');
   const release=archive.data.releases.find(r=>r.project===project.id&&r.name===`1.0.0@production+${build}`);assert.equal(release.created,Date.parse('2026-06-01T12:00:00Z'),'release_time is native release time');
  }
  assert.equal(archive.data.health_sessions.length,0);assert.equal(archive.data.health_aggregates.length,0);
  console.log('PROBE MIG-004 shapes: release_time, bundleVersion/errorClass, string columns and stability OBJECT -> reconciled; app.releaseStage -> two Android native events for one release; no fabricated sessions/rate.');
  const invalid=structuredClone(bundle);invalid.collections.at(-1).pages[0].response.project_id='android';
  const invalidFile=join(scratch,'invalid.json');await writeFile(invalidFile,JSON.stringify(invalid));
  await assert.rejects(cli('dry-run','--file',invalidFile,'--catchup'),error=>error.status===422,'stability object must match its declared project');
  assert.deepEqual((await archiveProjection(await req('/api/archive'))).data,archive.data,'refused source cannot change the native graph');
 }finally{await worker.stop();await rm(scratch,{recursive:true,force:true});delete process.env.SPOOL_BUGSNAG_SHAPES_SESSION}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await bugsnagMigrationFlow();
