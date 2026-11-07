import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { startTestWorker } from './worker.mjs';
import { rollbarScreens } from './rollbar-import/screens.mjs';
import { legacyMailRows } from './legacy-mail.mjs';
import { admissionRuntime } from './admission-runtime.mjs';
import { signIn } from './auth.mjs';
import { archiveProjection } from './archive.mjs';
import { rollbarDoorClient, rollbarImportCli } from '../scripts/rollbar-import.mjs';
import { rollbarFixture } from './rollbar-import/fixture.mjs';
import { followErasure } from './project-erasure/follow.mjs';

const scratch=await mkdtemp(join(tmpdir(),'spool-rollbar-'));
const outbound=[];
const worker=await admissionRuntime({}, {port:15529,hostedMail:true,networkEdge:async request=>{outbound.push(new URL(request.url).origin);return new Response('',{status:503});}});
const {origin}=worker;
let cookie=await signIn(origin,{emailLink:true});
const request=(path,method='GET',value,headers={})=>fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,...value?{'Content-Type':'application/json'}:{},...headers},...value?{body:JSON.stringify(value)}:{}});
const json=async(path,method,value,headers)=>{const response=await request(path,method,value,headers);assert.ok(response.ok,`${method??'GET'} ${path}: HTTP ${response.status}`);return response.json();};
const snapshot=async()=>(await archiveProjection(await request('/api/archive'))).data;
const cli=(action,...args)=>{process.env.SPOOL_ROLLBAR_SESSION=cookie;return rollbarImportCli([action,'--endpoint',origin,'--session-env','SPOOL_ROLLBAR_SESSION',...args]);};
try {
 await json('/api/projects','POST',{id:'native-rollbar-control',name:'Native checkout'});
 await json('/api/projects/native-rollbar-control/releases','POST',{name:'native@1.0.0',build:'b1'});
 const beforeMail=await legacyMailRows(origin);
 const before=await snapshot(),bundle=rollbarFixture(),file=join(scratch,'rollbar.json'),bytes=Buffer.from(JSON.stringify(bundle));
 await writeFile(file,bytes,{mode:0o600});
 const plan=await cli('dry-run','--file',file);
 assert.equal(plan.counts.rejected,0);assert.equal(plan.comparison.sourceCounts.items,24);assert.equal(plan.comparison.sourceCounts.occurrences,24);
 assert.equal(plan.comparison.deploys.length,2);assert.equal(plan.comparison.rules.length,4);assert.equal(plan.comparison.items[0].status,'resolved');
 assert.equal(plan.comparison.items[1].status,'active');assert.ok(plan.comparison.items[1].lastActivated>plan.comparison.items[1].lastResolved);
 assert.equal(plan.comparison.stacks[0].sourceFrames[1].line,27);
 assert.equal(plan.comparison.rules[0].rules[0].trigger,'reactivated_item');assert.equal(plan.comparison.rules[0].disposition,'retained_disabled');
 assert.ok(plan.comparison.unavailable.some(row=>row.kind==='artifacts'));
 assert.deepEqual(await snapshot(),before,'dry run writes no native data');
 const client=()=>rollbarDoorClient({endpoint:origin,cookie,project:'71'});
 assert.equal((await client().call('uploads',{uploadId:plan.uploadId})).bundleSha256,createHash('sha256').update(bytes).digest('hex'));
 const args=['--project','71','--plan',plan.planId,'--fingerprint',plan.fingerprint];
 await assert.rejects(cli('apply',...args.slice(0,-1),'0'.repeat(64)),error=>error.status===403);
 assert.deepEqual(await snapshot(),before,'wrong fingerprint cannot mutate populated native data');
 const first=await cli('apply',...args,'--once');
 assert.equal(first.job.state,'applying');assert.ok(first.job.checkpoint>0&&first.job.checkpoint<first.job.total,'a public bounded request stops midway');
 assert.deepEqual(await legacyMailRows(origin),beforeMail,'partial import sends no mail');
 const interrupted=await snapshot();assert.ok(interrupted.projects.length>before.projects.length);
 await worker.restart();
 cookie=await signIn(origin,{bootstrap:false,emailLink:true});
 const status=await cli('status','--project','71','--plan',plan.planId);
 assert.equal(status.job.id,first.job.id);assert.equal(status.job.checkpoint,first.job.checkpoint,'restart preserves the durable cursor');
 const resumeMail=await legacyMailRows(origin);
 const applied=await cli('resume',...args);assert.equal(applied.job.state,'completed');assert.equal(applied.job.id,first.job.id);
 assert.equal((await cli('resume',...args)).job.id,first.job.id,'replay is idempotent');
 const report=await cli('reconcile','--project','71','--plan',plan.planId);
 assert.equal(report.ok,true);assert.equal(report.counts.byKind.event,24);assert.equal(report.counts.byKind.issue,24);assert.equal(report.counts.byKind.release,1);
 assert.equal(report.comparison.nativeCounts.event,24);assert.equal(report.comparison.items[0].nativeState,'resolved');assert.equal(report.comparison.items[1].nativeState,'open');
 assert.equal(report.comparison.items[1].nativeOccurrences,1);assert.equal(report.comparison.items[1].sourceOccurrencesSinceResolution,37);
 assert.equal(report.comparison.stacks[0].nativeFrames[0].file,'src/checkout.js');assert.equal(report.comparison.stacks[0].nativeFrames[0].line,27);assert.equal(report.comparison.stacks[0].nativeFrames[0].column,11);
 assert.equal(report.comparison.stacks[0].nativeEnvironment,'production');assert.equal(report.comparison.stacks[0].nativeRelease,'checkout@1.0.0');
 assert.equal(report.comparison.deploys[0].nativeRelease.name,'checkout@1.0.0');assert.equal(report.comparison.deploys[1].nativeRelease.name,'checkout@1.0.0');
 assert.ok(report.sourceIds.some(row=>row.kind==='notification_rules'&&row.status==='explained'));
 assert.equal(report.comparison.history[0].events[1].text,'Reactivated by the next occurrence');
 const originalsPath=join(scratch,'originals.json');
 assert.deepEqual(await cli('originals','--project','71','--plan',plan.planId,'--output',originalsPath),{saved:true});
 const originals=JSON.parse(await readFile(originalsPath,'utf8')).originals;
 assert.deepEqual(Buffer.from(originals.find(row=>row.kind==='artifact').original.base64,'base64'),bytes,'private source bytes are exactly recoverable');
 const imported=report.projectIds[0],path=`/api/projects/${imported}`;
 const all=await snapshot(),historical=all.events.filter(row=>row.project===imported);
 assert.equal(historical.length,24);assert.ok(historical.every(row=>row.historical===1));
 assert.ok(historical.every(row=>!row.payload.includes('synthetic-spool-91')&&!row.payload.includes('private source remains')));
 for(const table of ['alerts','alert_rules','alert_rule_configs','alert_history','alert_scheduled_mail','spool_team_mail','reproducer_runs','fix_workflows'])assert.deepEqual(all[table],before[table],`history creates no ${table}`);
 assert.deepEqual(await legacyMailRows(origin),resumeMail,'resumed history sends no mail');
 assert.deepEqual(outbound,[],'import attempts no provider requests');
 assert.deepEqual(await json(path+'/alerting/rules'),[],'source rules never become executable native rules');
 assert.deepEqual(await json(path+'/alerting/deliveries'),[],'no delivery is pending or sent');
 assert.deepEqual(await json(path+'/keys'),[],'source never grants credentials');
 assert.deepEqual(await json(path+'/alerts'),[],'source never replays alerts');
 const issues=await json(path+'/issues'),historicalIssue=issues.find(row=>row.state==='resolved');
 const packet=await json(path+`/issues/${historicalIssue.id}/packet`);
 assert.equal(packet.events[0].historical,true);assert.equal(packet.events[0].currentLookup[0].source,'rollbar-api-export');
 assert.ok(packet.gaps.some(row=>row.code==='imported_history_no_live_events'));
 // Project grants and a foreign Origin cannot read or apply private custody.
 const grant=await json('/api/projects/native-rollbar-control/keys','POST',{kind:'agent'});
 for(const action of ['status','apply','undo']) {
  const response=await request('/api/operator/import/'+action,'POST',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{Cookie:'',Authorization:`Bearer ${grant.key}`,'X-Import-Source':'rollbar-project:71'});
  assert.ok([401,403].includes(response.status));
 }
 assert.equal((await request(`/api/imports/rollbar/71/${plan.planId}/originals`,'GET',undefined,{Cookie:'',Authorization:`Bearer ${grant.key}`})).status,403);
 assert.equal((await request(`/api/imports/rollbar/72/${plan.planId}/originals`)).status,404,'another source cannot borrow plan custody');
 assert.equal((await request('/api/operator/import/status','POST',{planId:plan.planId},{Origin:'https://foreign.example','X-Import-Source':'rollbar-project:71'})).status,401);
 assert.deepEqual((await snapshot()).events,all.events,'refused authority changes no imported events');
 // Replacement Node setup uses the actual SDK against the public intake route.
 await json(path+'/releases','POST',{name:'checkout@2.0.0',build:'b2'});
 const ingest=await json(path+'/keys','POST',{kind:'ingest'});
 const sdkFile=join(scratch,'sdk.mjs');
 await build({entryPoints:['packages/sdk/src/node.ts'],outfile:sdkFile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const sdk=await import(pathToFileURL(sdkFile).href),capture=sdk.init({endpoint:origin,project:imported,ingestKey:ingest.key,release:'checkout@2.0.0',build:'b2'});
 try {
  const error=new TypeError('New checkout capture');error.stack='TypeError: New checkout capture\n    at chargeCard (https://checkout.example/app.js:27:12)';
  const result=await sdk.captureException(error,['checkout: payment submitted']);assert.equal(result.outcome,'accepted');
  const fresh=await json(path+`/issues/${result.issue}/packet`);
  assert.equal(fresh.events[0].historical,false);assert.equal(fresh.events[0].event.release,'checkout@2.0.0');assert.equal(fresh.events[0].event.build,'b2');
  assert.equal(fresh.events[0].event.frames[0].function,'chargeCard');assert.equal(fresh.events[0].event.breadcrumbs[0],'checkout: payment submitted');
 } finally {capture.close();}
 assert.equal((await cli('reconcile','--project','71','--plan',plan.planId)).ok,true,'live capture does not rewrite historical groups');
 await rollbarScreens(origin,cookie,imported,historicalIssue.id);
 // Native edits fence undo rather than being overwritten by the source.
 const edited=issues.find(row=>row.state==='open');await json(path+`/issues/${edited.id}`,'PATCH',{state:'acknowledged',revision:edited.revision});
 const editedSnapshot=await snapshot();
 await assert.rejects(cli('undo','--project','71','--plan',plan.planId),error=>error.status===409);
 assert.equal((await json(path+'/issues')).find(row=>row.id===edited.id).state,'acknowledged');
 const refusedUndo=await snapshot();
 assert.deepEqual(refusedUndo.events,editedSnapshot.events,'guarded refusal removes no event');
 assert.deepEqual(refusedUndo.issues,editedSnapshot.issues,'guarded refusal preserves all native edits');
 // Erasure withdraws source custody and prevents re-import and archive replay.
 const archive=await (await request('/api/archive')).text();
 const restored=await startTestWorker(15530);
 try {
  const restoredCookie=await signIn(restored.origin);
  const response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive});
  assert.equal(response.status,200,'portable Rollbar history restores through the ordinary restore door');
  const restoredData=(await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}))).data;
  assert.deepEqual(restoredData.events.filter(row=>row.historical===1),editedSnapshot.events.filter(row=>row.historical===1));
  const history=await (await fetch(restored.origin+'/api/imports/business',{headers:{Cookie:restoredCookie}})).json();
  assert.deepEqual(history.history,[],'restore transfers no executable import custody');
 } finally {await restored.stop();}
 const preview=await json(path+'/erasure');assert.equal(preview.hold,null);
 const accepted=await json(path+'/erasure','POST',{confirm:imported,planHash:preview.planHash});
 const erased=await followErasure((p,m)=>json(p,m),accepted);assert.equal(erased.phase,'complete');
 assert.ok(!(await json('/api/projects')).some(row=>row.id===imported));
 await assert.rejects(client().status(plan.planId),error=>error.status===404);
 await assert.rejects(client().originals(plan.planId),error=>error.status===404,'erased originals stay withdrawn');
 const replayUpload=await client().upload(bytes);
 await assert.rejects(client().call('plan',{uploadId:replayUpload.uploadId}),error=>error.code==='source_erased');
 const replay=await fetch(origin+'/api/restore',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/x-ndjson','X-Confirm-Restore':'yes'},body:archive});
 assert.equal(replay.status,400);assert.equal((await replay.json()).error,'erasure_epoch');
 // The supported undo case restores populated pre-import native rows.
 const safeBundle=rollbarFixture();safeBundle.project.result.id=72;
 for(const collection of safeBundle.collections)for(const page of collection.pages){
  const result=page.response.result;
  for(const row of result.items??result.deploys??[])row.project_id=72;
 }
 const safeClient=rollbarDoorClient({endpoint:origin,cookie,project:'72'}),safeBefore=await snapshot();
 const safePlan=await safeClient.plan(Buffer.from(JSON.stringify(safeBundle)));
 assert.equal(safePlan.counts.rejected,0);await safeClient.apply(safePlan.planId,safePlan.fingerprint);
 assert.equal((await safeClient.reconcile(safePlan.planId)).ok,true);
 assert.equal((await safeClient.undo(safePlan.planId)).job.state,'undone');
 const safeAfter=await snapshot();
 for(const table of ['projects','issues','events','releases'])assert.deepEqual(safeAfter[table],safeBefore[table],`supported undo restores ${table}`);
 await request('/auth/signout','POST',{});
 await assert.rejects(client().status(plan.planId),error=>error.status===401,'revoked session cannot read custody');
 await assert.rejects(client().originals(plan.planId),error=>error.status===401,'revoked session cannot read originals');
 console.log('Rollbar migration journey passed: source comparisons, durable interrupted resume, inert history, real SDK replacement, authority and guarded undo, erasure and replay refusal.');
} finally {await worker.close();await rm(scratch,{recursive:true,force:true});delete process.env.SPOOL_ROLLBAR_SESSION;}
