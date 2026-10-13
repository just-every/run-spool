import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime, successor, snapshot, eraseInput, confirmLatest } from './owner-erasure/helpers.mjs';

// These are fixture writes at the destructive transaction boundary. Requests
// still traverse the emitted application's real HTTP/auth/erasure handlers.
export async function authorityRaces() {
 const results=[];
 for(const party of ['predecessor','successor','capture']) {
  const app=await runtime();
  try {
   const next=await successor(app);
   const owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
   const other=await app.DB.prepare('SELECT * FROM oa_operators WHERE email=?').bind(next.email).first();
   await app.json('/api/projects',{id:'race-proof',name:'Test owner retained until authority is proven'},201);
   const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,null);
   const target=party==='predecessor'?owner.id:other.id;
   // Fixture writes model an external change at the exact durable-open boundary.
   // Temporarily owning the transaction guard allows that change through the
   // normal freeze; no product handler or erasure batch is replaced.
   const mutation=party==='capture'?"UPDATE projects SET name=name||' changed' WHERE id='race-proof';":`UPDATE oa_sessions SET revoked_at=1 WHERE operator_id='${target}';`;
   await app.DB.prepare(`CREATE TRIGGER fixture_change_plan AFTER INSERT ON rer_erasure_operations
    WHEN NEW.entity='installation-owner' BEGIN
    INSERT INTO rer_erasure_guard(value) VALUES(1);
    ${mutation}
    DELETE FROM rer_erasure_guard; END`).run();
   const before=await snapshot(app);
   const response=await app.request('/api/owner/erasure',eraseInput(preview));
   const body=await response.json();assert.equal(response.status,409,JSON.stringify(body));
   const after=await snapshot(app);
   for(const [table,rows] of Object.entries(before)) {
    const expected=party!=='capture'&&table==='oa_sessions'?rows.map(row=>row.operator_id===target?{...row,revoked_at:1}:row):
     party==='capture'&&table==='projects'?rows.map(row=>row.id==='race-proof'?{...row,name:row.name+' changed'}:row):
     // Base creates the installation's portability identity on first use; a refusal may create it but never advance its epoch.
     table==='rer_portability_state'&&!rows.length&&after[table].length===1?[{...after[table][0],epoch:0,applying:0,import_job:null}]:rows;
    assert.deepEqual(after[table],expected,`${party} refusal preserves ${table} apart from the injected change`);
   }
   assert.equal(after.rer_erasure_operations.length,0,'refused first step releases the durable freeze');
   await app.DB.prepare('DROP TRIGGER fixture_change_plan').run();
   if(party==='predecessor') {
    assert.equal((await app.call('/auth/session',undefined,{Cookie:next.cookie})).status,200,'surviving successor session remains usable');
    assert.equal((await app.call('/auth/magic-link',{email:owner.email})).status,202);
    app.cookie=await confirmLatest(app,owner.email);
   } else {
    assert.equal((await app.request('/api/projects')).status,200,'surviving owner session remains usable');
    if(party==='successor') {
     assert.equal((await app.call('/auth/magic-link',{email:next.email})).status,202);
     next.cookie=await confirmLatest(app,next.email);
    }
   }
   await app.json('/api/projects',{id:'recovered-write',name:'Recovered ordinary owner write'},201);
   const refreshed=await app.json('/api/owner/erasure');assert.equal(refreshed.hold,null);
   const receipt=await app.json('/api/owner/erasure',eraseInput(refreshed));assert.equal(receipt.phase,'complete');
   results.push({party,status:response.status,error:body.error,refusedOperations:0,survivingSession:'accepted',freshSignIn:'accepted',ownerWrite:'accepted',reconfirmed:receipt.phase});
  } finally {await app.close();}
 }
 return results;
}

export async function heldScopes(app,otherId) {
 const owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
 const cases=[
  {hold:'identifier_in_structural_key',plant:()=>app.json('/api/projects',{id:owner.id,name:'Unrelated project label'},201),clear:()=>app.DB.batch([app.DB.prepare('DELETE FROM audit WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM credentials WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM projects WHERE id=?').bind(owner.id)])},
  {hold:'ambiguous_display_name',plant:()=>app.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(owner.display_name,otherId).run(),clear:()=>app.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind('Quinn Otherperson',otherId).run()},
  {hold:'ambiguous_identity_attribution',plant:()=>app.DB.prepare('UPDATE oa_operators SET email=? WHERE id=?').bind('prefix-'+owner.email,otherId).run(),clear:()=>app.DB.prepare('UPDATE oa_operators SET email=? WHERE id=?').bind('quinn@spool.test',otherId).run()},
 ];
 const invite=randomUUID();
 cases.push({hold:'shared_invitation_provenance',plant:()=>app.DB.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at) VALUES(?,?,'invite',?,1,?,?, '/',?,?)").bind(invite,randomUUID(),otherId,owner.id,owner.version,Date.now(),Date.now()+60000).run(),clear:()=>app.DB.prepare('DELETE FROM oa_tokens WHERE id=?').bind(invite).run()});
 const results=[];
 for(const test of cases) {
  await test.plant();
  try {
   const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,test.hold,JSON.stringify(preview));
   const before=await snapshot(app),response=await app.request('/api/owner/erasure',eraseInput(preview));
   assert.equal(response.status,409);assert.deepEqual(await snapshot(app),before,test.hold+' changes no stored row');
   results.push({hold:test.hold,status:response.status,unchanged:true});
  } finally {await test.clear();}
 }
 return results;
}
