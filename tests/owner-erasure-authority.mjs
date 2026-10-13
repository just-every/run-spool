import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runtime, successor, snapshot, eraseInput } from './owner-erasure/helpers.mjs';

// These are fixture writes at the destructive transaction boundary. Requests
// still traverse the emitted application's real HTTP/auth/erasure handlers.
export async function authorityRaces() {
 const results=[];
 for(const party of ['predecessor','successor']) {
  const app=await runtime();
  try {
   const next=await successor(app);
   const owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
   const other=await app.DB.prepare('SELECT * FROM oa_operators WHERE email=?').bind(next.email).first();
   await app.json('/api/projects',{id:'race-proof',name:'Test owner retained until authority is proven'},201);
   const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,null);
   const target=party==='predecessor'?owner.id:other.id;
   // Revocation lands after the handler has re-read its preview and recorded
   // confirmation, but before the first deletion transaction can commit.
   await app.DB.prepare(`CREATE TRIGGER fixture_revoke_authority AFTER INSERT ON rer_erasure_operations
    WHEN NEW.entity='installation-owner' BEGIN
    UPDATE oa_sessions SET revoked_at=1 WHERE operator_id='${target}'; END`).run();
   const before=await snapshot(app);
   const response=await app.request('/api/owner/erasure',eraseInput(preview));
   const body=await response.json();assert.equal(response.status,409,JSON.stringify(body));
   const after=await snapshot(app);
   for(const [table,rows] of Object.entries(before)) {
    // The confirmed attempt and revocation are durable bookkeeping. Nothing
    // in the subject graph or captured data may be deleted/redacted/promoted.
    if(['rer_erasure_operations','spool_owner_successor'].includes(table))continue;
    const expected=table==='oa_sessions'?rows.map(row=>row.operator_id===target?{...row,revoked_at:1}:row):rows;
    assert.deepEqual(after[table],expected,`${party} commit race preserves ${table}`);
   }
   assert.equal(after.rer_erasure_operations.length,1);
   assert.equal(after.rer_erasure_operations[0].step,0);
   assert.deepEqual(JSON.parse(after.rer_erasure_operations[0].deleted),{});
   results.push({party,status:response.status,error:body.error,deleted:0,step:0});
  } finally {await app.close();}
 }
 return results;
}

export async function heldScopes(app,otherId) {
 const owner=await app.DB.prepare("SELECT * FROM oa_operators WHERE role='owner'").first();
 const cases=[
  {hold:'identifier_in_structural_key',plant:()=>app.json('/api/projects',{id:owner.id,name:'Unrelated project label'},201),clear:()=>app.DB.batch([app.DB.prepare('DELETE FROM credentials WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM projects WHERE id=?').bind(owner.id)])},
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
