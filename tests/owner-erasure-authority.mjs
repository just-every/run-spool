import { assertAuditAppendOnly } from './owner-erasure/helpers.mjs';
import {followErasure} from './project-erasure/follow.mjs';
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
    if(['spool_audit_events','audit_actor_links','deployment_actors'].includes(table))assertAuditAppendOnly({[table]:after[table]},{[table]:expected},'refusal appends only safe observations');else assert.deepEqual(after[table],expected,`${party} refusal preserves ${table} apart from the injected change`);
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
  {hold:'identifier_in_structural_key',plant:()=>app.json('/api/projects',{id:owner.id,name:'Unrelated project label'},201),clear:()=>app.DB.batch([app.DB.prepare('DELETE FROM audit WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM audit_actor_links WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM spool_native_audit_actors WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM agent_door_events WHERE uri=?').bind('spool://projects/'+owner.id),app.DB.prepare('DELETE FROM credentials WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM short_id_prefixes WHERE project=?').bind(owner.id),app.DB.prepare('DELETE FROM projects WHERE id=?').bind(owner.id)])},
  // "Test ownership" holds the owner's display name only inside a longer word: held, and the text stays intact.
  {hold:'identifier_inside_longer_token',plant:()=>app.json('/api/projects',{id:'longer-token',name:'Test ownership dashboard'},201),clear:()=>app.DB.batch([app.DB.prepare('DELETE FROM audit WHERE project=?').bind('longer-token'),app.DB.prepare('DELETE FROM audit_actor_links WHERE project=?').bind('longer-token'),app.DB.prepare('DELETE FROM spool_native_audit_actors WHERE project=?').bind('longer-token'),app.DB.prepare('DELETE FROM agent_door_events WHERE uri=?').bind('spool://projects/'+'longer-token'),app.DB.prepare('DELETE FROM credentials WHERE project=?').bind('longer-token'),app.DB.prepare('DELETE FROM short_id_prefixes WHERE project=?').bind('longer-token'),app.DB.prepare('DELETE FROM projects WHERE id=?').bind('longer-token')])},
  // A hyphenated name that ends in the owner's name is another person's token, as one that starts with it is.
  {hold:'identifier_inside_longer_token',plant:()=>app.json('/api/projects',{id:'hyphen-token',name:'Mary-Test owner dashboard'},201),clear:()=>app.DB.batch([app.DB.prepare('DELETE FROM audit WHERE project=?').bind('hyphen-token'),app.DB.prepare('DELETE FROM audit_actor_links WHERE project=?').bind('hyphen-token'),app.DB.prepare('DELETE FROM spool_native_audit_actors WHERE project=?').bind('hyphen-token'),app.DB.prepare('DELETE FROM agent_door_events WHERE uri=?').bind('spool://projects/'+'hyphen-token'),app.DB.prepare('DELETE FROM credentials WHERE project=?').bind('hyphen-token'),app.DB.prepare('DELETE FROM short_id_prefixes WHERE project=?').bind('hyphen-token'),app.DB.prepare('DELETE FROM projects WHERE id=?').bind('hyphen-token')])},
  {hold:'ambiguous_display_name',plant:()=>app.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(owner.display_name,otherId).run(),clear:()=>app.DB.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind('Quinn Otherperson',otherId).run()},
  {hold:'ambiguous_identity_attribution',plant:()=>app.DB.prepare('UPDATE oa_operators SET email=? WHERE id=?').bind('prefix-'+owner.email,otherId).run(),clear:()=>app.DB.prepare('UPDATE oa_operators SET email=? WHERE id=?').bind('quinn@spool.test',otherId).run()},
 ];
 cases.push({hold:'identifier_in_unsupported_surface',plant:async()=>{
  const project=await app.json('/api/projects',{id:'owner-operator-label',name:'Operator attribution'},201);
  await app.json('/api/projects/owner-operator-label/releases',{name:'r1',build:'b1'},201);
  const accepted=await app.json('/api/ingest/owner-operator-label',{version:1,eventId:'attribution-event',release:'r1',build:'b1',environment:'test',type:'Error',message:'Synthetic error',frames:[{file:'app.js',line:1,column:0,function:'run'}],breadcrumbs:[]},201,{Authorization:'Bearer '+project.ingestKey});
  const issue=(await app.json('/api/projects/owner-operator-label/issues')).find(i=>i.id===accepted.issue);
  const assigned=await app.request(`/api/projects/owner-operator-label/issues/${issue.id}/assignment`,{revision:issue.revision,label:owner.display_name},{},'PATCH');assert.equal(assigned.status,200);
 },clear:async()=>{const path='/api/projects/owner-operator-label/erasure',plan=await app.json(path);const accepted=await app.json(path,{confirm:'owner-operator-label',planHash:plan.planHash},202);assert.equal((await followErasure(async(url,method)=>{const response=await app.request(url,undefined,{},method);assert.ok(response.ok);return response.json();},accepted)).phase,'complete')}});
 const invite=randomUUID();
 cases.push({hold:'shared_invitation_provenance',plant:()=>app.DB.prepare("INSERT INTO oa_tokens(id,token_hash,kind,operator_id,operator_version,issuer_id,issuer_version,return_to,created_at,expires_at) VALUES(?,?,'invite',?,1,?,?, '/',?,?)").bind(invite,randomUUID(),otherId,owner.id,owner.version,Date.now(),Date.now()+60000).run(),clear:()=>app.DB.prepare('DELETE FROM oa_tokens WHERE id=?').bind(invite).run()});
 const results=[];
 for(const test of cases) {
  await test.plant();
  try {
   const preview=await app.json('/api/owner/erasure');assert.equal(preview.hold,test.hold,JSON.stringify(preview));
   const before=await snapshot(app),response=await app.request('/api/owner/erasure',eraseInput(preview));
   assert.equal(response.status,409);assertAuditAppendOnly(await snapshot(app),before,test.hold+' changes no stored row');
   results.push({hold:test.hold,status:response.status,unchanged:true});
  } finally {await test.clear();}
 }
 return results;
}
