import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime, successor, snapshot, eraseInput, confirmLatest } from './owner-erasure/helpers.mjs';

export async function interruptedErasure() {
 const app=await runtime();
 try {
  const next=await successor(app),owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
  const project=await app.json('/api/projects',{id:'resume-proof',name:'Test owner and Quinn Otherperson'},201);
  // A real graph larger than a request batch. These historical sessions are
  // fixture data, not alternate handler implementations or a changed batch cap.
  const count=600;
  for(let from=0;from<count;from+=100)await app.DB.batch(Array.from({length:Math.min(100,count-from)},()=>app.DB.prepare("INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES(?,?,?,?,'native',?,?)").bind(randomUUID(),randomUUID(),owner.id,owner.version,Date.now(),Date.now()+600000)));
  const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,null);
  await app.DB.prepare(`CREATE TRIGGER fixture_interrupt_second_batch BEFORE INSERT ON rer_erasure_guard
   WHEN EXISTS(SELECT 1 FROM rer_erasure_operations WHERE entity='installation-owner' AND phase='deleting' AND step>0)
   BEGIN SELECT RAISE(ABORT,'fixture_interrupted_after_committed_batch'); END`).run();
  const response=await app.request('/api/owner/erasure',eraseInput(preview));assert.equal(response.status,503);
  const interrupted=await app.DB.prepare("SELECT * FROM rer_erasure_operations WHERE entity='installation-owner'").first();
  assert.equal(interrupted.phase,'deleting');assert.ok(interrupted.step>0);
  const deleted=JSON.parse(interrupted.deleted);assert.ok(deleted.oa_sessions>0&&deleted.oa_sessions<count);
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM rer_erasure_guard').first()).n,0,'batch guard never leaks between transactions');
  assert.equal((await app.DB.prepare("SELECT count(*) n FROM oa_operators WHERE role='owner' AND status='active'").first()).n,1);
  assert.equal((await app.request('/api/projects')).status,401,'predecessor is fenced after first committed batch');
  assert.equal((await app.call('/api/projects',undefined,{Cookie:next.cookie})).status,401,'old successor session is fenced');
  const frozen=await snapshot(app);
  await assert.rejects(()=>app.DB.prepare('UPDATE projects SET name=? WHERE id=?').bind('delayed write Test owner','resume-proof').run(),/owner_erasure_in_progress/);
  await assert.rejects(()=>app.DB.prepare("INSERT INTO credentials(hash,project,kind,created,minted_by,minted_version) VALUES(?,'resume-proof','agent',?,?,?)").bind(randomUUID(),Date.now(),owner.id,owner.version).run(),/owner_erasure_in_progress|credential_authority_changed/);
  assert.deepEqual(await snapshot(app),frozen,'paused operation rejects delayed writes atomically');
  await app.DB.prepare('DROP TRIGGER fixture_interrupt_second_batch').run();
  await app.restart();
  const tick=await fetch(app.origin+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*&format=json');
  assert.equal(tick.status,200,await tick.text());
  const complete=await app.DB.prepare('SELECT * FROM rer_erasure_operations WHERE id=?').bind(interrupted.id).first();
  assert.equal(complete.phase,'complete');assert.ok(complete.step>interrupted.step);assert.equal(complete.subject,null);
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM oa_sessions WHERE operator_id=?').bind(owner.id).first()).n,0);
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM rer_erasure_scope').first()).n,0);
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM rer_erasure_guard').first()).n,0);
  const before=await snapshot(app);
  // Simulate the INSERT of an already-admitted mint after deletion and after
  // the temporary freeze has gone. The durable authority guard must reject it.
  await assert.rejects(()=>app.DB.prepare("INSERT INTO credentials(hash,project,kind,created,minted_by,minted_version) VALUES(?,'resume-proof','agent',?,?,?)").bind(randomUUID(),Date.now(),owner.id,owner.version).run(),/credential_authority_changed/);
  assert.deepEqual(await snapshot(app),before,'late predecessor mint is nonmutating after completion');
  assert.equal((await app.call('/auth/magic-link',{email:next.email})).status,202);
  app.cookie=await confirmLatest(app,next.email);
  const receipts=await app.json('/api/owner/erasure/receipts');assert.equal(receipts.length,1);assert.equal(receipts[0].id,interrupted.id);assert.equal(receipts[0].phase,'complete');
  const key=await app.json('/api/projects/resume-proof/keys',{kind:'agent'},201);assert.ok(key.key);
  // The project's ingest key outlives its minter: deployed SDKs keep reporting and the key stays listed.
  await app.json('/api/projects/resume-proof/releases',{name:'r1',build:'b1'},201);
  const event=id=>({version:1,eventId:id,release:'r1',build:'b1',environment:'test',type:'Error',message:'checkout failed',frames:[{file:'https://app.test/a.js',line:1,column:0,function:'run'}],breadcrumbs:[]});
  assert.equal((await app.call('/api/ingest/resume-proof',event('after-handoff'),{Authorization:'Bearer '+project.ingestKey})).status,201,'pre-erasure ingest key still ingests');
  assert.ok((await app.json('/api/projects/resume-proof/keys')).some(row=>row.kind==='ingest'&&!row.revoked),'pre-erasure ingest key is still listed');
  assert.equal((await app.DB.prepare('SELECT count(*) n FROM credentials WHERE minted_by=?').bind(owner.id).first()).n,0,'no key keeps the erased owner as minter');
  // A key minted before a later identity fence (the linked Auth install moves the version) can still be revoked.
  const fenced=await app.json('/api/projects/resume-proof/keys',{kind:'ingest'},201);
  await app.DB.prepare("UPDATE oa_operators SET version=version+1 WHERE email=?").bind(next.email).run();
  assert.equal((await app.call('/auth/magic-link',{email:next.email})).status,202);
  app.cookie=await confirmLatest(app,next.email);
  assert.equal((await app.request('/api/projects/resume-proof/keys/'+fenced.hash,undefined,{},'DELETE')).status,200,'key minted before a fence is revocable');
  assert.equal((await app.call('/api/ingest/resume-proof',event('after-revoke'),{Authorization:'Bearer '+fenced.key})).status,401,'revoked key no longer ingests');
  const report={seededSessions:count,interruptedStep:interrupted.step,interruptedDeleted:deleted,completedStep:complete.step,completedDeleted:JSON.parse(complete.deleted),phase:complete.phase,lateCredentialInsert:'rejected',successorMint:'accepted',ingestKeyAfterErasure:'accepted',revokeAfterFence:'accepted'};
  console.log('Owner erasure resumption: '+JSON.stringify(report));return report;
 } finally {await app.close();}
}
