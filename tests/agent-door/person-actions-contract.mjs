import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Real agent credentials never stand in for a signed-in person's decision. */
export async function personActionsContract(app){
 const done=answer=>{assert.ok(answer&&!answer.isError,answer?._meta?.['com.runeditrun/error']?.code??'Missing result');return answer.structuredContent;};
 const project='synthetic-spool-person-actions';
 const created=await app.json('/api/projects','POST',{id:project,name:'Person action qualification'});
 await app.json('/api/projects/'+project+'/releases','POST',{name:'1.0.0',build:'synthetic-spool-1'});
 const captured=await app.json('/api/ingest/'+project,'POST',{version:1,eventId:'synthetic-spool-1',release:'1.0.0',build:'synthetic-spool-1',environment:'production',type:'TypeError',message:'Person action boundary',frames:[{file:'https://checkout.example/app.js',line:1,column:0,function:'total'}],breadcrumbs:[]},{Cookie:'',Authorization:'Bearer '+created.ingestKey});
 const grant=await app.json('/api/projects/'+project+'/keys','POST',{kind:'agent'});
 const credentials=[['Business',await accessToken(app.context)],['exact-project',grant.key]];
 const tables=(await app.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()).results;
 const snapshot=async()=>{
  const result={};
  for(const {name} of tables){
   const rows=(await app.DB.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all()).results;
   result[name]=rows.map(row=>JSON.stringify(row)).sort();
  }
  return result;
 };
 for(const policyName of ['held','autonomous']){
  // Pending actions and review entries originate in native tool execution,
  // never in inserted rows or invented record identifiers.
  const held=heldPolicy();await app.adopt(held);
  const issue=(await app.json('/api/projects/'+project+'/issues')).find(row=>row.id===captured.issue);
  const packet=done(await app.call('spool.packets.read',{project,issue:issue.id}));
  const proposed=await app.call('spool.proposals.create',{project,kind:'split',source:issue.id,revision:issue.revision,events:[packet.events[0].id],variants:[{stack:JSON.stringify(packet.events[0].event.frames),release:'1.0.0',route:''}],rationale:'Keep the person decision separate from agent preparation.',window:{start:packet.events[0].received,end:packet.events[0].received+1},idempotency_key:randomUUID()});
  const proposal=done(proposed),review=proposed._meta?.['com.runeditrun/review'];assert.ok(review?.id);
  const nextState=issue.state==='suppressed'?'open':'suppressed';
  const prepared=await app.call('spool.issues.update',{project,issue:issue.id,state:nextState,revision:issue.revision,idempotency_key:randomUUID()});
  const pending=prepared._meta?.['com.runeditrun/approval']??prepared._meta?.['com.runeditrun/error']?.approval;assert.ok(pending?.id);
  const approval=(await app.json('/agents/api/approvals/'+pending.id)).approval;
  assert.equal(approval.state,'pending');assert.deepEqual(approval.approvals,[]);
  assert.equal(approval.revision,app.context.revision);assert.match(approval.summary_sha256,/^[a-f0-9]{64}$/);
  assert.equal((await app.json('/agents/api/reviews')).reviews.find(row=>row.id===review.id).state,'open');
  assert.ok((await app.json('/api/projects/'+project+'/grouping-proposals')).some(row=>row.id===proposal.id));
  if(policyName==='autonomous')await app.adopt(autonomousPolicy());
  // Prove that these very tokens are accepted at the agent door under the
  // current policy; a broken, expired or out-of-project token proves nothing.
  for(const [kind,token] of credentials){
   const response=await app.request('/mcp','POST',{jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name:'spool.issues.list',arguments:{project}}},{Cookie:'',Authorization:'Bearer '+token,'MCP-Protocol-Version':'2025-11-25'});
   assert.equal(response.status,200,kind+' credential is currently admitted');
   assert.ok(done((await response.json()).result).items.some(row=>row.id===issue.id),kind+' credential reads the real scoped issue');
  }
  const before=await snapshot();
  for(const [kind,token] of credentials){
   for(const cookie of ['',app.cookie]){
    const session=cookie?'with person session':'without person session';
    for(const [path,body] of [
     ['/agents/api/approvals/'+pending.id+'/approve',{revision:approval.revision,summary_sha256:approval.summary_sha256}],
     ['/agents/api/reviews/'+review.id+'/reviewed',{}],
    ]){
     const response=await app.request(path,'POST',body,{Cookie:cookie,Authorization:'Bearer '+token});
     assert.equal(response.status,403,policyName+' '+kind+' '+session+' person action is forbidden');
     assert.equal((await response.json()).code,'person_session_required');
     assert.deepEqual(await snapshot(),before,'Refusal preserves approval marks, reviews, policy and every native record');
    }
   }
  }
  console.log('PROBE BASE-AGENT-008 acceptance-2 '+policyName+': valid Business and exact-project tokens POST real approval and review IDs, with and without person session -> 403 person_session_required; all persisted state unchanged');
  // Review marks are a person's own act under either current policy.
  const marked=await app.json('/agents/api/reviews/'+review.id+'/reviewed','POST',{});
  assert.equal(marked.review.state,'reviewed');assert.ok(marked.review.marked_by);assert.ok(marked.review.marked_at);
  const owner=(await app.DB.prepare("SELECT id FROM oa_operators WHERE role='owner' AND status='active'").first()).id;
  assert.equal(marked.review.marked_by,owner);
  assert.equal((await app.json('/agents/api/reviews')).reviews.find(row=>row.id===review.id).marked_by,owner);
  // A pending approval was saved under held policy. Restore that exact signed
  // revision before its positive control, preserving the native evidence fence.
  if(policyName==='autonomous')await app.adopt(held,{revision:approval.revision});
  const approved=await app.json('/agents/api/approvals/'+pending.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
  assert.equal(approved.approval.state,'executed');
  assert.ok(approved.approval.approvals.some(mark=>mark.person===owner&&mark.ref==='sponsor'));
  assert.equal(approved.approval.prepared_by.agent.id,app.context.agentId);
  const readBack=(await app.json('/agents/api/approvals/'+pending.id)).approval;
  assert.equal(readBack.state,'executed');assert.deepEqual(readBack.approvals,approved.approval.approvals);
  const changed=(await app.json('/api/projects/'+project+'/issues')).find(row=>row.id===issue.id);
  assert.equal(changed.state,nextState);assert.equal(changed.revision,issue.revision+1);
  console.log('PROBE BASE-AGENT-008 person-controls '+policyName+': signed-in person marks reviewed under current policy and approves under matching saved policy -> person attribution persists and native issue changes exactly once');
 }
 await app.adopt();
}
