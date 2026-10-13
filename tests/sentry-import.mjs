import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startTestWorker } from './worker.mjs';
import { signIn } from './auth.mjs';
import { archiveProjection } from './archive.mjs';
const worker=await startTestWorker(15523),{origin}=worker;
try{
  let cookie=await signIn(origin);
  const req=(path,method='GET',value,headers={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,...value?{'Content-Type':'application/json'}:{},...headers},...value?{body:JSON.stringify(value)}:{}});
  const json=async(path,method,value,headers)=>{const response=await req(path,method,value,headers);assert.ok(response.ok,`${method??'GET'} ${path}: HTTP ${response.status}`);return response.json()};
  const native=await json('/api/projects','POST',{id:'native',name:'Untouched native project'}),beforeProjects=await json('/api/projects');
  const bytes=await readFile(new URL('./fixtures/sentry/organization.json',import.meta.url)),source=bytes.toString('base64');
  const archiveBefore=await archiveProjection(await req('/api/archive'));
  const planned=await json('/api/imports/sentry/plan','POST',{source,operationKey:'fixture-import'});assert.equal(planned.dryRun,true);assert.equal(planned.counts.effects,4);assert.equal(planned.counts.duplicates,1);assert.equal(planned.counts.rejected,0);assert.ok(planned.entries.some(row=>row.kind==='dashboards'&&row.unmapped.length));assert.ok(planned.entries.some(row=>row.effects.some(effect=>effect.kind==='event'&&effect.value.native.historical===1)),'review shows the exact scrubbed historical target');assert.ok(!JSON.stringify(planned).includes('IMPORT_SECRET'));assert.ok(!JSON.stringify(planned).includes('PRIVATE_LABEL'));
  const archiveAfter=await archiveProjection(await req('/api/archive'));assert.deepEqual(archiveAfter.data,archiveBefore.data,'planning mutates neither native data nor job/original journals');
  assert.deepEqual(await json('/api/projects'),beforeProjects);
  assert.equal((await req('/api/imports/sentry/apply','POST',{source,reviewedFingerprint:'wrong',operationKey:'fixture-import'})).status,409);
  assert.deepEqual(await json('/api/projects'),beforeProjects);
  const applyBody={source,reviewedFingerprint:planned.fingerprint,operationKey:'fixture-import'};
  let applied=await json('/api/imports/sentry/apply','POST',applyBody),job=applied.job;
  for(let index=0;index<20&&job.state!=='completed';index++)job=(await json(`/api/imports/sentry/fixture-org/${job.id}/resume`,'POST')).job;
  assert.equal(job.state,'completed');const id=job.id;
  const retry=await json('/api/imports/sentry/apply','POST',applyBody);assert.equal(retry.job.id,id);
  const snapshot=await json(`/api/imports/sentry/fixture-org/${id}`);assert.equal(snapshot.rows.length,4);assert.equal(snapshot.provenance.length,4);
  const importedProject=snapshot.rows.find(row=>row.targetKind==='project').value.native;
  const importedIssue=snapshot.rows.find(row=>row.targetKind==='issue').value.native;
  assert.equal((await json(`/api/projects/${importedProject.id}/keys`)).length,0,'imported projects have no credentials');
  assert.equal((await json(`/api/projects/${importedProject.id}/alerts`)).length,0,'historical rows create no alerts');
  const packet=await json(`/api/projects/${importedProject.id}/issues/${importedIssue.id}/packet`);assert.equal(packet.events.length,1);assert.equal(packet.events[0].historical,true);assert.equal(packet.events[0].currentLookup[0].status,'imported_raw_stack');assert.equal(packet.events[0].event.frames[0].column,11);assert.ok(!JSON.stringify(packet).includes('IMPORT_SECRET'));assert.ok(!JSON.stringify(packet).includes('PRIVATE_LABEL'));assert.ok(!JSON.stringify(packet).includes('person@example.com'));
  const originals=await json(`/api/imports/sentry/fixture-org/${id}/originals`);assert.equal(originals.length,1);assert.equal(originals[0].original.base64,source,'exact original export bytes are privately retained');
  // Denial needs no export body: a large body the server refuses unread resets the socket mid-upload.
  for(const kind of ['agent','ingest','deploy']){
    const grant=await json('/api/projects/native/keys','POST',{kind});
    for(const [path,method,value] of [[`/api/imports/sentry/fixture-org/${id}`,'GET'],[`/api/imports/sentry/fixture-org/${id}/originals`,'GET'],[`/api/imports/sentry/fixture-org/${id}/undo`,'POST'],['/api/imports/sentry/plan','POST',{}]])assert.ok([401,403].includes((await req(path,method,value,{Cookie:'',Authorization:`Bearer ${grant.key}`})).status),`${kind} cannot access import custody`);
  }
  // New owner session reopens the durable job; no in-memory journal is needed.
  cookie=await signIn(origin,{bootstrap:false});assert.equal((await json(`/api/imports/sentry/fixture-org/${id}/resume`,'POST')).job.state,'completed');
  let undone=(await json(`/api/imports/sentry/fixture-org/${id}/undo`,'POST')).job;
  for(let index=0;index<20&&undone.state!=='undone';index++)undone=(await json(`/api/imports/sentry/fixture-org/${id}/undo`,'POST')).job;
  assert.equal(undone.state,'undone');assert.deepEqual(await json('/api/projects'),beforeProjects,'undo removes only imported graph');
  assert.equal((await json(`/api/imports/sentry/fixture-org/${id}/originals`))[0].original.base64,source);
  const secondPlan=await json('/api/imports/sentry/plan','POST',{source,operationKey:'fixture-conflict'});const again=await json('/api/imports/sentry/apply','POST',{...applyBody,reviewedFingerprint:secondPlan.fingerprint,operationKey:secondPlan.operationKey});let second=again.job;for(let step=0;step<20&&second.state!=='completed';step++)second=(await json(`/api/imports/sentry/fixture-org/${second.id}/resume`,'POST')).job;
  const current=(await json(`/api/projects/${importedProject.id}/issues`))[0];await json(`/api/projects/${importedProject.id}/issues/${current.id}`,'PATCH',{state:'acknowledged',revision:current.revision});
  const conflicting=await req(`/api/imports/sentry/fixture-org/${second.id}/undo`,'POST');assert.equal(conflicting.status,409);assert.equal((await json(`/api/projects/${importedProject.id}/issues`))[0].state,'acknowledged','guarded undo preserves native edit');
  const nativeArchive=await (await req('/api/archive')).arrayBuffer();
  await req('/auth/signout','POST',{});assert.equal((await req(`/api/imports/sentry/fixture-org/${second.id}/originals`)).status,401);assert.equal((await req(`/api/imports/sentry/fixture-org/${second.id}/undo`,'POST')).status,401);
  await worker.stop();
  const restored=await startTestWorker(15524);
  try{
    const restoredCookie=await signIn(restored.origin);
    const response=await fetch(restored.origin+'/api/restore',{method:'POST',headers:{Origin:restored.origin,Cookie:restoredCookie,'X-Confirm-Restore':'yes','Content-Type':'application/x-ndjson'},body:nativeArchive});assert.equal(response.status,200,'native archive restores scrubbed imported history');
    const restoredArchive=await archiveProjection(await fetch(restored.origin+'/api/archive',{headers:{Cookie:restoredCookie}}));
    const archived=await archiveProjection(new Response(nativeArchive));assert.deepEqual(restoredArchive.data,archived.data,'history marker and source identities survive native archive restore');
    const keys=await (await fetch(`${restored.origin}/api/projects/${importedProject.id}/keys`,{headers:{Cookie:restoredCookie}})).json();assert.deepEqual(keys,[]);
    assert.equal((await fetch(`${restored.origin}/api/imports/sentry/fixture-org/${second.id}/originals`,{headers:{Cookie:restoredCookie}})).ok,false,'native archives do not transfer private source originals or executable import jobs');
  }finally{await restored.stop()}
  console.log('Sentry org import fixture public flows passed: no-write plan, reviewed apply, exact originals, duplicates, inert native graph, scope denial, reopen/resume, relation-safe undo, native-edit/revoked-session protection and inert archive restore. Synthetic export only.');
}finally{await worker.stop()}
