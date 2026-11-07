import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {accessToken,autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Real agent credentials never stand in for a signed-in person's decision. */
export async function personActionsContract(app,screens){
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
  const action={project,issue:issue.id,state:nextState,revision:issue.revision,idempotency_key:randomUUID()};
  const prepared=await app.call('spool.issues.update',action);
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
     ['/agents/api/policy',{document:autonomousPolicy()}],
    ]){
     const response=await app.request(path,path==='/agents/api/policy'?'PUT':'POST',body,{Cookie:cookie,Authorization:'Bearer '+token});
     assert.equal(response.status,403,policyName+' '+kind+' '+session+' person action is forbidden');
     assert.equal((await response.json()).code,'person_session_required');
     assert.deepEqual(await snapshot(),before,'Refusal preserves approval marks, reviews, policy and every native record');
    }
   }
  }
  console.log('PROBE BASE-AGENT-008 acceptance-2 '+policyName+': valid Business and exact-project tokens POST real approval and review IDs and policy answers, with and without person session -> 403 person_session_required; all persisted state unchanged');
  const clean=await app.call('spool.issues.list',{project});
  const flags={confirmed:true,person_confirmed:true,approved:true,confirmation:'accept'};
  const flagged=await app.call('spool.issues.list',{project,...flags});
  assert.deepEqual(done(flagged),done(clean),'Person confirmation arguments change no native read');
  assert.deepEqual(flagged._meta['com.runeditrun/decision'].classes,clean._meta['com.runeditrun/decision'].classes,'Confirmation flags change neither classes nor policy decisions');
  const unconfirmed=await app.call('spool.issues.update',action);
  const nativeBefore=await app.json('/api/projects/'+project+'/issues');
  const accepted=await app.mcp('tools/call',{name:'spool.issues.update',arguments:{...action,...flags},requestState:prepared.requestState,inputResponses:{approval:{action:'accept',content:{confirmed:true}}},_meta:{'io.modelcontextprotocol/clientCapabilities':{elicitation:{form:{},url:{}}}}},{},'2026-07-28');
  assert.equal(accepted.resultType,'input_required','Form acceptance does not complete a saved action under either current policy');
  assert.equal(accepted._meta['com.runeditrun/approval'].id,pending.id);
  assert.equal(accepted.inputRequests.approval.params.mode,'url','Only the real person URL is offered');
  assert.deepEqual(accepted._meta['com.runeditrun/decision'].classes,unconfirmed._meta['com.runeditrun/decision'].classes);
  const stillPending=(await app.json('/agents/api/approvals/'+pending.id)).approval;
  assert.equal(stillPending.state,'pending');assert.deepEqual(stillPending.approvals,[]);
  assert.deepEqual(await app.json('/api/projects/'+project+'/issues'),nativeBefore,'A form accept and injected confirmation flags execute no native write');
  console.log('PROBE BASE-AGENT-008 acceptance-1-and-3 '+policyName+': MCP confirmation flags and form accept with the real pending request state -> identical classes and input_required, no approval mark or native effect');
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
  const auditRows=[];let after='0';
  for(;;){const page=await app.json('/agents/api/audit?after='+after);auditRows.push(...page.rows);if(!page.rows.length)break;after=page.cursor;}
  const approvalRows=auditRows.filter(row=>row.approval?.id===pending.id);
  assert.ok(approvalRows.some(row=>row.outcome==='done'&&row.decision==='approval'),'The public activity contains the actual approved execution');
  for(const row of approvalRows){assert.equal(row.label,'Agent door conformance for Dana Engineer');assert.equal(row.agent.id,app.context.agentId);assert.equal(row.sponsor.id,owner);assert.deepEqual(row.approval.by,[owner]);}
  assert.equal(readBack.prepared_by.label,'Agent door conformance for Dana Engineer');
  await screens?.capture('person-attribution-'+policyName,'/agents','Agent door conformance for Dana Engineer',async page=>{
   const rendered=await page.locator('section[aria-labelledby="activity-title"] li .meta').allTextContents();
   const recent=auditRows.slice(-20).reverse();assert.equal(rendered.length,recent.length,'Activity renders every returned recent act');
   for(let index=0;index<recent.length;index++)assert.ok(rendered[index].includes(recent[index].agent.name+' for '+recent[index].sponsor.name),'Every recent act shows its agent and person');
  });
  console.log('PROBE BASE-AGENT-008 acceptance-5-and-6 '+policyName+': signed person approval -> durable named approver and separate agent preparer; populated activity at 1440 with 390 capture');
  if(policyName==='autonomous')await app.adopt(autonomousPolicy());
  const destination=await app.json('/api/projects/'+project+'/alerting/destinations','POST',{label:'Agent sender '+policyName,recipient:'sender-control@synthetic.invalid'});
  const mailArgs={project,id:destination.id,idempotency_key:randomUUID()};
  const mailCall=await app.call('spool.alerts.test',mailArgs);
  if(policyName==='held'){
   const mailPending=mailCall._meta['com.runeditrun/error'].approval;
   const mailApproval=(await app.json('/agents/api/approvals/'+mailPending.id)).approval;
   assert.ok(!(await app.mail()).some(message=>message.text?.includes('project '+project+'.')),'The held external send produces no mail before approval');
   const result=await app.json('/agents/api/approvals/'+mailPending.id+'/approve','POST',{revision:mailApproval.revision,summary_sha256:mailApproval.summary_sha256});assert.equal(result.approval.state,'executed');
  }else done(mailCall);
  const sent=done(await app.call('spool.alerts.test',mailArgs));
  const messages=(await app.mail()).filter(message=>message.deliveryId===sent.id);
  assert.equal(messages.length,1,'A replay sends no duplicate mail');
  assert.match(messages[0].from,/^Agent door conformance for Dana Engineer <[^<>]+>$/);
  assert.ok(messages[0].text.includes('Prepared by Agent door conformance for Dana Engineer.'));
  if(policyName==='held')assert.ok(messages[0].text.includes('Approved by Dana Engineer.'));
  const personDestination=await app.json('/api/projects/'+project+'/alerting/destinations','POST',{label:'Person sender '+policyName,recipient:'sender-control@synthetic.invalid'});
  const personTest=await app.json('/api/projects/'+project+'/alerting/destinations/'+personDestination.id+'/test','POST',{});
  const personMessage=(await app.mail()).find(message=>message.deliveryId===personTest.id);assert.ok(personMessage);
  assert.ok(!personMessage.from.includes('Agent door conformance'),'A real person send keeps its installation sender');
  const mailbox=value=>value.match(/<([^<>]+)>$/)?.[1]??value;
  assert.equal(mailbox(messages[0].from),mailbox(personMessage.from),'Only the sender display name changes; the approved mailbox stays the same');
  console.log('PROBE BASE-AGENT-008 acceptance-7 '+policyName+': native agent TEST -> one provider payload with agent and sponsor sender; matching real-person TEST retains installation sender and the same sending mailbox');
 }
 await app.adopt();
}
