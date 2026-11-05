import assert from 'node:assert/strict';
import {randomUUID,webcrypto} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {agentRuntime} from './runtime.mjs';
import {autonomousPolicy,heldPolicy,policyEnvelope,signJws} from '../../src/modules/agent-door/conformance/crypto.mjs';

const code=answer=>answer?._meta?.['com.runeditrun/error']?.code;
const approval=answer=>answer?._meta?.['com.runeditrun/error']?.approval;

// Inputs enter the emitted Worker's native capture, policy and MCP doors.
// D1 is a read-only witness of retained policy, approvals and native records.
export async function policyIntegrityContract(){
 for(const mode of ['autonomous','held']){
  const app=await agentRuntime(0);
  try{
   const project='synthetic-spool-305-'+mode;
   const created=await app.json('/api/projects','POST',{id:project,name:project});
   await app.json(`/api/projects/${project}/releases`,'POST',{name:'synthetic-spool-305',build:'synthetic-spool-305'});
   const captured=await app.json('/api/ingest/'+project,'POST',{
    version:1,eventId:'synthetic-spool-305',release:'synthetic-spool-305',build:'synthetic-spool-305',
    environment:'test',type:'TypeError',message:'synthetic-spool-305',
    frames:[{file:'https://synthetic.invalid/app.js',line:1,column:0,function:'syntheticSpool'}],breadcrumbs:[],
   },{Authorization:'Bearer '+created.ingestKey});
   const document=mode==='held'?heldPolicy():autonomousPolicy();
   const adopted=await app.adopt(document);
   assert.deepEqual(adopted.adopted,{seq:1,revision:1});
   const issues=()=>app.json(`/api/projects/${project}/issues`);
   const nativeBefore=await issues();
   assert.equal(nativeBefore.length,1);
   assert.equal(nativeBefore[0].id,captured.issue);
   assert.equal(nativeBefore[0].state,'open');
   const args=()=>({project,issue:captured.issue,state:'suppressed',revision:nativeBefore[0].revision,idempotency_key:randomUUID()});
   let existingApproval;
   if(mode==='held'){
    const held=await app.call('spool.issues.update',args());
    assert.equal(code(held),'approval_required');
    existingApproval=approval(held);
    assert.ok(existingApproval?.id,'The held fixture has a real pending action');
    assert.equal((await app.json('/agents/api/approvals/'+existingApproval.id)).approval.state,'pending');
    assert.deepEqual(await issues(),nativeBefore,'The existing held action has no native effect');
   }
   const storedPolicy=async()=>JSON.parse((await app.DB.prepare('SELECT envelope FROM agent_door_state WHERE id=1').first()).envelope);
   const pending=async()=>(await app.DB.prepare('SELECT * FROM agent_door_approvals ORDER BY id').all()).results;
   const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*' AND name NOT GLOB 'agent_door_*' AND name<>'spool_audit_events' ORDER BY name").all()).results;
   const native=async()=>Object.fromEntries(await Promise.all(tables.map(async({name})=>[
    name,(await app.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()).results.map(row=>JSON.stringify(row)).sort(),
   ])));
   const policyBefore=await storedPolicy(),pendingBefore=await pending(),stateBefore=await app.json('/agents/api/state');
   assert.equal(policyBefore.seq,1);assert.equal(policyBefore.revision,1);
   assert.deepEqual(policyBefore.document,document);
   assert.equal(pendingBefore.length,mode==='held'?1:0);
   const recordsBefore=await native();
   const audit=async()=>(await app.DB.prepare('SELECT * FROM spool_audit_events ORDER BY sequence').all()).results;
   const auditBefore=await audit();
   // Retain the trusted revision signature and all valid claims. Only the
   // outer envelope signature comes from an untrusted, run-generated key.
   const replacement=mode==='held'?autonomousPolicy():heldPolicy();
   const signed=await policyEnvelope(app.context,replacement,{revoked:{agents:[app.context.agentId],consents:[app.context.consent]}});
   const untrusted=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
   const forged=await signJws(untrusted.privateKey,app.context.signer.kid,'rer-agent-policy+jwt',signed.payload);
   const rejected=await app.request('/api/rer/agent-policy','POST',{policy:forged},{Cookie:''});
   assert.equal(rejected.status,400,'An untrusted envelope signature is refused');
   assert.deepEqual(await rejected.json(),{code:'policy_invalid'},'Signature refusal has the typed policy error');
   assert.deepEqual(await storedPolicy(),policyBefore,'Rejection preserves the full stored envelope, including sequence, revision and document');
   assert.deepEqual(await pending(),pendingBefore,'Rejection preserves every pending action and its saved facts');
   const recordsAfter=await native(),changedTables=tables.map(row=>row.name).filter(name=>!isDeepStrictEqual(recordsAfter[name],recordsBefore[name]));
   assert.deepEqual(changedTables,[],'Rejection preserves every native product record');
   const auditAfter=await audit();
   assert.ok(isDeepStrictEqual(auditAfter.slice(0,auditBefore.length),auditBefore),'Rejection preserves the complete existing audit chronology');
   assert.equal(auditAfter.length,auditBefore.length+1,'Only the required HTTP refusal fact is appended');
   const refusal=auditAfter.at(-1);
   assert.equal(refusal.source,'request');assert.equal(refusal.status,400);assert.equal(refusal.outcome,'invalid');
   assert.deepEqual(await app.json('/agents/api/state'),stateBefore,'The owner still sees the last valid policy');
   assert.deepEqual(await issues(),nativeBefore,'The captured issue remains unchanged after rejection');
   const subsequent=await app.call('spool.issues.update',args());
   assert.equal(subsequent._meta['com.runeditrun/decision'].revision,policyBefore.revision);
   if(mode==='held'){
    assert.equal(code(subsequent),'approval_required','The original held policy still requires approval');
    assert.ok(approval(subsequent)?.id);
    assert.notEqual(approval(subsequent).id,existingApproval.id);
    assert.deepEqual(await issues(),nativeBefore,'The next held call has no native effect');
    assert.equal((await app.json('/agents/api/approvals/'+existingApproval.id)).approval.state,'pending','The earlier approval remains pending');
    assert.equal((await pending()).length,2);
   }else{
    assert.equal(subsequent.isError,false,'The original autonomous policy still executes the scoped call');
    const changed=await issues();assert.equal(changed[0].id,captured.issue);
    assert.equal(changed[0].state,'suppressed');assert.equal(changed[0].revision,nativeBefore[0].revision+1);
    assert.deepEqual(await pending(),[],'Autonomous execution creates no approval');
   }
   assert.deepEqual(await storedPolicy(),policyBefore,'The next call also retains the original policy');
   const control=await app.json('/api/rer/agent-policy','POST',{policy:signed.policy});
   assert.deepEqual(control.adopted,{seq:signed.payload.seq,revision:signed.payload.revision},'The otherwise identical envelope succeeds with its trusted signature');
   assert.deepEqual((await storedPolicy()).document,replacement);
   console.log(`PROBE BASE-AGENT-007 acceptance-8-${mode}: untrusted-key policy POST -> 400 policy_invalid, stored policy and pending actions unchanged, native records preserved; subsequent MCP update follows original ${mode} policy; trusted-signature control adopted`);
  }finally{await app.stop();}
 }
}
