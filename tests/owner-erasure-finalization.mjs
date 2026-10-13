import assert from 'node:assert/strict';
import { runtime, successor, snapshot, eraseInput, confirmLatest } from './owner-erasure/helpers.mjs';

export async function interruptedFinalization() {
 const app=await runtime();
 try {
  const next=await successor(app),owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
  await app.json('/api/projects',{id:'finalization-proof',name:'Test owner and Quinn Otherperson'},201);
  const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,null);
  await app.DB.prepare(`CREATE TRIGGER fixture_interrupt_finalization BEFORE UPDATE OF phase ON rer_erasure_operations
   WHEN OLD.entity='installation-owner' AND OLD.phase='blobs' AND NEW.phase='complete'
   BEGIN SELECT RAISE(ABORT,'fixture_interrupted_before_complete'); END`).run();
  const response=await app.request('/api/owner/erasure',eraseInput(preview));assert.equal(response.status,503);
  const paused=await app.DB.prepare("SELECT * FROM rer_erasure_operations WHERE entity='installation-owner'").first();
  assert.equal(paused.phase,'blobs');assert.ok(paused.step>0);assert.equal(paused.subject,null);
  const before=await snapshot(app);
  await assert.rejects(()=>app.DB.prepare('UPDATE projects SET name=? WHERE id=?').bind(owner.email+' and Quinn Otherperson','finalization-proof').run(),/owner_erasure_in_progress/);
  assert.deepEqual(await snapshot(app),before,'a paused finalization still refuses captured-data writes atomically');
  await app.DB.prepare('DROP TRIGGER fixture_interrupt_finalization').run();
  await app.restart();
  const tick=await fetch(app.origin+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*&format=json');assert.equal(tick.status,200,await tick.text());
  const complete=await app.DB.prepare('SELECT * FROM rer_erasure_operations WHERE id=?').bind(paused.id).first();
  assert.equal(complete.phase,'complete');assert.ok(complete.step>paused.step);
  const after=await snapshot(app);
  for(const needle of [owner.id,owner.email,owner.display_name])assert.ok(!JSON.stringify(after).includes(needle),'completed finalization leaves no predecessor identifier');
  assert.equal((await app.call('/auth/magic-link',{email:next.email})).status,202);
  app.cookie=await confirmLatest(app,next.email);
  await app.json('/api/projects',{id:'after-finalization',name:'Successor writes normally'},201);
  return {interruptedPhase:paused.phase,delayedCapture:'refused',completedPhase:complete.phase,successorWrite:'accepted'};
 } finally {await app.close();}
}
