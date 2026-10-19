import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { archiveProjection } from './archive.mjs';
import { sentryImportCli, sentryDoorClient } from '../scripts/sentry-import.mjs';
const worker=await startTestWorker(15523),{origin}=worker;
const scratch=await mkdtemp(join(tmpdir(),'spool-sentry-import-'));
try{
  let cookie=await signIn(origin);
  // Without Run Edit Run's owner-claim trust there is no signer: the cutover read does not exist.
  assert.equal((await fetch(origin+'/api/rer/cutover-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({since:new Date().toISOString()})})).status,404);
  const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...value?{'Content-Type':'application/json'}:{},...headers},...value?{body:JSON.stringify(value)}:{}});
  const json=async(path,method,value,headers)=>{const response=await req(path,method,value,headers);assert.ok(response.ok,`${method??'GET'} ${path}: HTTP ${response.status}`);return response.json()};
  // The documented CLI, through the import door, with the session in an environment variable.
  const cli=(...args)=>{process.env.SPOOL_TEST_SESSION=cookie;return sentryImportCli([args[0],'--endpoint',origin,'--session-env','SPOOL_TEST_SESSION',...args.slice(1)])};
  const native=await json('/api/projects','POST',{id:'native',name:'Untouched native project'}),beforeProjects=await json('/api/projects');
  const fixture=new URL('./fixtures/sentry/organization.json',import.meta.url),bytes=await readFile(fixture);
  const archiveBefore=await archiveProjection(await req('/api/archive'));
  const planned=await cli('dry-run','--file',fixture.pathname);
  assert.equal(planned.organization,'fixture-org');assert.equal(planned.namespace,'sentry-org:fixture-org');
  assert.equal(planned.counts.effects,4);assert.equal(planned.counts.duplicates,1);assert.equal(planned.counts.rejected,0);assert.deepEqual(planned.rejected,[]);
  assert.equal(planned.summary.created,planned.differences.additions.length);assert.ok(/^[a-f0-9]{64}$/.test(planned.fingerprint));
  assert.ok(!JSON.stringify(planned).includes('IMPORT_SECRET'));assert.ok(!JSON.stringify(planned).includes('PRIVATE_LABEL'));
  const archiveAfter=await archiveProjection(await req('/api/archive'));assert.deepEqual(archiveAfter.data,archiveBefore.data,'planning mutates neither native data nor job/original journals');
  assert.deepEqual(await json('/api/projects'),beforeProjects);
  const wrong=(planned.fingerprint[0]==='0'?'1':'0')+planned.fingerprint.slice(1);
  await assert.rejects(cli('apply','--organization','fixture-org','--plan',planned.planId,'--fingerprint',wrong),error=>/HTTP 403/.test(error.message),'an unreviewed fingerprint is refused');
  assert.deepEqual(await json('/api/projects'),beforeProjects);
  const applyArgs=['--organization','fixture-org','--plan',planned.planId,'--fingerprint',planned.fingerprint];
  const {job}=await cli('apply',...applyArgs);assert.equal(job.state,'completed');const id=job.id;
  const retry=await cli('apply',...applyArgs);assert.equal(retry.job.id,id,'repeating apply answers the same durable job');
  const report=await cli('reconcile','--organization','fixture-org','--plan',planned.planId);
  assert.equal(report.ok,true);assert.equal(report.fingerprint,planned.fingerprint);assert.deepEqual(report.counts.byKind,{project:1,release:1,issue:1,event:1});
  assert.ok(report.sourceIds.some(row=>row.kind==='dashboards'&&row.status==='explained'&&row.reason),'unsupported collections stay explained, without native effects');
  const projects=await json('/api/projects'),importedProject=projects.find(project=>!beforeProjects.some(before=>before.id===project.id));
  const importedIssue=(await json(`/api/projects/${importedProject.id}/issues`))[0];
  assert.equal((await json(`/api/projects/${importedProject.id}/keys`)).length,0,'imported projects have no credentials');
  assert.equal((await json(`/api/projects/${importedProject.id}/alerts`)).length,0,'historical rows create no alerts');
  const packet=await json(`/api/projects/${importedProject.id}/issues/${importedIssue.id}/packet`);assert.equal(packet.events.length,1);assert.equal(packet.events[0].historical,true);assert.equal(packet.events[0].currentLookup[0].status,'imported_raw_stack');assert.equal(packet.events[0].event.frames[0].column,11);assert.ok(!JSON.stringify(packet).includes('IMPORT_SECRET'));assert.ok(!JSON.stringify(packet).includes('PRIVATE_LABEL'));assert.ok(!JSON.stringify(packet).includes('person@example.com'));
  const client=sentryDoorClient({endpoint:origin,cookie,organization:'fixture-org'}),retained=await client.call('uploads',{uploadId:planned.uploadId});
  assert.equal(retained.bundleSha256,createHash('sha256').update(bytes).digest('hex'),'exact original export bytes are privately retained');
  // Denial needs no export body: a large body the server refuses unread resets the socket mid-upload.
  for(const kind of ['agent','ingest','deploy']){
    const grant=await json('/api/projects/native/keys','POST',{kind});
    for(const [path,method,value,headers] of [['/api/operator/import/status','POST',{planId:planned.planId},{'X-Import-Source':'sentry-org:fixture-org'}],['/api/operator/import/undo','POST',{planId:planned.planId},{'X-Import-Source':'sentry-org:fixture-org'}],['/api/operator/import/plan','POST',{},{'X-Import-Source':'sentry-org:fixture-org'}],['/api/imports/business','GET'],[`/api/imports/sentry/fixture-org/${id}/originals`,'GET']])assert.ok([401,403].includes((await req(path,method,value,{Cookie:'',Authorization:`Bearer ${grant.key}`,...headers})).status),`${kind} cannot access import custody`);
  }
  assert.equal((await req('/api/operator/import/status','POST',{planId:planned.planId},{'X-Import-Source':'sentry-org:fixture-org',Origin:'https://evil.example'})).status,401,'a cross-origin owner request is refused');
  assert.equal((await req('/api/operator/import/status','POST',{planId:planned.planId},{'X-Import-Source':'imports-elsewhere'})).status,400,'only listed import sources reach the door');
  // New owner session reopens the durable job; no in-memory journal is needed.
  cookie=await signIn(origin,{bootstrap:false});assert.equal((await cli('status','--organization','fixture-org','--plan',planned.planId)).job.state,'completed');
  assert.equal((await cli('apply',...applyArgs)).job.id,id);
  const undone=await cli('undo','--organization','fixture-org','--plan',planned.planId);
  assert.equal(undone.job.state,'undone');assert.deepEqual(await json('/api/projects'),beforeProjects,'undo removes only imported graph');
  // A fresh bundle of the same organization: legal trailing whitespace changes its bytes, not its records.
  const second=join(scratch,'organization.json');await writeFile(second,Buffer.concat([bytes,Buffer.from('\n')]),{mode:0o600});
  const secondPlan=await cli('dry-run','--file',second);assert.notEqual(secondPlan.planId,planned.planId);
  await cli('apply','--organization','fixture-org','--plan',secondPlan.planId,'--fingerprint',secondPlan.fingerprint);
  const current=(await json(`/api/projects/${importedProject.id}/issues`))[0];await json(`/api/projects/${importedProject.id}/issues/${current.id}`,'PATCH',{state:'acknowledged',revision:current.revision});
  await assert.rejects(cli('undo','--organization','fixture-org','--plan',secondPlan.planId),error=>/HTTP 409/.test(error.message),'guarded undo refuses to overwrite a native edit');
  assert.equal((await json(`/api/projects/${importedProject.id}/issues`))[0].state,'acknowledged','guarded undo preserves native edit');
  const nativeArchive=await (await req('/api/archive')).arrayBuffer();
  await req('/auth/signout','POST',{});
  assert.equal((await req('/api/operator/import/status','POST',{planId:secondPlan.planId},{'X-Import-Source':'sentry-org:fixture-org'})).status,401);
  assert.equal((await req('/api/operator/import/undo','POST',{planId:secondPlan.planId},{'X-Import-Source':'sentry-org:fixture-org'})).status,401);
  await worker.stop();
  const restored=await startTestWorker(15524);
  try{
    const restoredCookie=await signIn(restored.origin);
    const response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'X-Confirm-Restore':'yes','Content-Type':'application/x-ndjson'},body:nativeArchive});assert.equal(response.status,200,'native archive restores scrubbed imported history');
    const restoredArchive=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}));
    const archived=await archiveProjection(new Response(nativeArchive));assert.deepEqual(restoredArchive.data,archived.data,'history marker and source identities survive native archive restore');
    const keys=await (await fetch(`${restored.origin}/api/projects/${importedProject.id}/keys`,{headers:{Cookie:restoredCookie}})).json();assert.deepEqual(keys,[]);
    const restoredDoor=sentryDoorClient({endpoint:restored.origin,cookie:restoredCookie,organization:'fixture-org'});
    await assert.rejects(restoredDoor.status(secondPlan.planId),error=>error.status===404,'native archives do not transfer private source originals or executable import jobs');
  }finally{await restored.stop()}
  console.log('Sentry org import fixture public flows passed through the import door: CLI no-write plan, reviewed apply, retained exact bytes, duplicates, inert native graph, scope and origin denial, reopen/resume, relation-safe undo, native-edit/revoked-session protection and inert archive restore. Synthetic export only.');
}finally{await worker.stop();await rm(scratch,{recursive:true,force:true});delete process.env.SPOOL_TEST_SESSION}
