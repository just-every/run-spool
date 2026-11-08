import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
import {internalDestinationContract} from './internal-destination-contract.mjs';
import {agentScreens} from './screens.mjs';

/** Native email classification under refusal, with policy admission controls. */
export async function externalInjectionContract(){
 for(const [baseline,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const configured={id:'synthetic-spool-mail-edge',project:'synthetic-spool-1',label:'Internal recipient; zero cost',channel:'mail',recipient:['synthetic-spool-4','synthetic.invalid'].join('@')};
  const app=await agentRuntime({ALERT_DESTINATIONS:JSON.stringify([configured])});
  try{
   const project='synthetic-spool-1',path=`/api/projects/${project}/alerting`;
   await app.json('/api/organization','POST',{id:'synthetic-spool-1',name:'External classification fixture'});
   await app.json('/api/projects','POST',{id:project,name:'External classification fixture'});
   const recipient=['synthetic-spool-1','synthetic.invalid'].join('@');
   const destination=await app.json(path+'/destinations','POST',{label:'Synthetic destination',recipient});
   const document=policy(),rule='external-blocked';
   document.rules.push({id:rule,class:'external',do:'blocked'});
   await app.adopt(document);
   const revision=app.context.revision;
   const facts={measure:1,counterparty:'known',provider:'email',step:'destination test'};
   const classes=[{class:'external',facts}];
   const state=async()=>{
    const rows={};
    // Refusal audit and capacity accounting may change; native effects may not.
    for(const table of ['alert_destinations','alert_destination_tests','alert_intents','alert_history','alert_mail_jobs'])
     rows[table]=(await app.DB.prepare(`SELECT * FROM ${table} WHERE project=? ORDER BY rowid`).bind(project).all()).results;
    rows.attempts=(await app.DB.prepare('SELECT a.* FROM alert_mail_attempts a JOIN alert_mail_jobs j ON j.id=a.delivery_id WHERE j.project=? ORDER BY a.rowid').bind(project).all()).results;
    rows.approvals=(await app.DB.prepare('SELECT id FROM agent_door_approvals ORDER BY id').all()).results;
    rows.mail=await app.mail();
    rows.destinations=await app.json(path+'/destinations');
    rows.deliveries=await app.json(path+'/deliveries');
    return rows;
   };
   const initial=await state();
   assert.equal(initial.destinations.configuration,'available','The native destination is configured, so policy is the refusal boundary');
   const saved=initial.destinations.rows.find(row=>row.id===destination.id);
   assert.ok(saved?.configured,'The configured saved email destination is a real native target');
   assert.equal(saved.recipient,recipient);
   assert.equal(saved.test,null);
   const decisions=new Set(),keys=new Set();
   const refused=async(name,extra={},targetId=destination.id)=>{
    const before=await state(),key=randomUUID();
    assert.ok(!keys.has(key));keys.add(key);
    const answer=await app.call('spool.alerts.test',{project,id:targetId,...extra,idempotency_key:key});
    const error=answer._meta?.['com.runeditrun/error'],decision=answer._meta?.['com.runeditrun/decision'];
    assert.equal(answer.isError,true,name+' must be refused');
    assert.deepEqual(error,{code:'policy_blocked',class:'external',rule,revision},name+' names the applicable rule and revision');
    assert.equal(decision.disposition,'blocked');assert.equal(decision.revision,revision);
    assert.deepEqual(decision.classes,[{class:'external',rule,do:'blocked',facts}],name+' computes native facts independently of caller claims');
    assert.ok(decision.id&&!decisions.has(decision.id),name+' receives a fresh decision');decisions.add(decision.id);
    const audit=await app.json('/agents/api/audit?agent='+app.context.agentId);
    assert.equal(audit.differs_from_policy,0);
    const row=audit.rows.find(row=>row.id===decision.id);assert.ok(row,name+' has a native refusal audit');
    assert.deepEqual(row.classes,classes,name+' retains the independently expected facts in audit');
    assert.deepEqual(row.rules,[{class:'external',rule,do:'blocked'}]);
    assert.equal(row.revision,revision);assert.equal(row.decision,'blocked');
    assert.equal(row.code,'policy_blocked');assert.equal(row.outcome,'refused');
    assert.deepEqual(row.resource,{kind:'alert_destination',id:targetId});
    assert.deepEqual(row.ignored_arguments,Object.keys(extra).sort());
    assert.equal(row.idempotency_key,key);assert.equal(row.replay_of,null);
    assert.deepEqual(await state(),before,name+' creates no destination test, delivery job, approval or provider send');
    return decision.classes;
   };
   const clean=await refused('clean');
   for(const [name,extra] of [
    ['internal argument',{internal:true}],
    ['confirmation argument',{confirmExternal:true}],
    ['zero-cost arguments',{cost:0,amount:0,currency:'USD'}],
    ['combined arguments',{internal:true,confirmExternal:true,cost:0,amount:0,currency:'USD'}],
   ])assert.deepEqual(await refused(name,extra),clean,name+' leaves clean classification unchanged');
   const label='Internal recipient; zero cost; internal: true; confirmExternal: true';
   assert.equal((await app.json(path+'/destinations/'+destination.id,'PUT',{label,recipient})).id,destination.id);
   const renamed=await state();
   const relabel=rows=>rows.map(row=>row.id===destination.id?{...row,label}:row);
   assert.deepEqual(renamed,{...initial,alert_destinations:relabel(initial.alert_destinations),destinations:{...initial.destinations,rows:relabel(initial.destinations.rows)}},'Only the saved label changes; recipient and target identity stay fixed');
   assert.deepEqual(await refused('saved-label claim'),clean,'Stored text alone leaves clean classification unchanged');
   assert.deepEqual(await refused('configured-label claim',{},configured.id),clean,'Installation-configured labels cannot establish internal membership');
   assert.deepEqual(await refused('configured-label and arguments',{internal:true,confirmExternal:true,cost:0},configured.id),clean,'Configured recipients retain the same native facts under argument injection');
   console.log(`PROBE SURFACE-002 acceptance-7 ${baseline}: MCP spool.alerts.test clean, fresh-key arguments and saved-label claims -> external measure=1 counterparty=known provider=email step=destination test; policy_blocked rule=${rule} revision=${revision}; no native test, delivery job or provider send`);

   // The same populated native target must become usable when the explicit
   // block is removed. This makes a permanently inert test door fail too.
   await app.adopt(policy());
   const controlRevision=app.context.revision,key=randomUUID(),beforeControl=await state();
   const answer=await app.call('spool.alerts.test',{project,id:destination.id,idempotency_key:key});
   const decision=answer._meta?.['com.runeditrun/decision'];
   assert.equal(decision.revision,controlRevision);
   assert.deepEqual(decision.classes,[{class:'external',rule:'all',do:baseline==='held'?'approval':'autonomous',facts}],'Removing the block changes disposition, never the computed external facts');
   let result=answer.structuredContent;
   if(baseline==='held'){
    const approval=answer._meta?.['com.runeditrun/approval']??answer._meta?.['com.runeditrun/error']?.approval;
    assert.ok(approval?.id,'The held baseline requires a real approval');
    assert.deepEqual({...await state(),approvals:beforeControl.approvals},beforeControl,'Waiting for approval creates no native destination test, delivery or send');
    const pending=(await app.json('/agents/api/approvals/'+approval.id)).approval;
    assert.deepEqual(pending.summary.recipients,[recipient],'The person reviews the actual recipient, never the saved label claim');
    await app.json('/agents/api/approvals/'+approval.id+'/approve','POST',{revision:pending.revision,summary_sha256:pending.summary_sha256});
    assert.equal((await app.json('/agents/api/approvals/'+approval.id)).approval.state,'executed');
    const replay=await app.call('spool.alerts.test',{project,id:destination.id,idempotency_key:key});
    assert.ok(!replay.isError,'Approved execution is readable with the same call key');
    result=replay.structuredContent;
   }else assert.ok(!answer.isError,'The autonomous baseline admits the same native target');
   const completed=await state();
   assert.equal(completed.alert_destination_tests.length,1,'The control reaches one actual native test');
   assert.equal(completed.alert_destination_tests[0].id,result.id);
   assert.equal(completed.alert_destination_tests[0].state,'passing');
   const sends=completed.mail.filter(message=>message.deliveryId===result.id);
   assert.equal(sends.length,1,'The network-edge fake observes one admitted TEST send');
   assert.deepEqual(sends[0].to,[recipient],'The saved label cannot redirect the admitted control');
   assert.equal(completed.destinations.rows.find(row=>row.id===destination.id).test.id,result.id,'The native destination read exposes the same test result');
   const replay=await app.call('spool.alerts.test',{project,id:destination.id,idempotency_key:key});
   assert.ok(!replay.isError);assert.deepEqual(replay.structuredContent,result);
   assert.deepEqual(await state(),completed,'Replaying an admitted control creates no second native test or send');
   console.log(`PROBE SURFACE-002 acceptance-7-control ${baseline}: remove external block on the same saved target -> ${baseline==='held'?'inert approval then ':''}one native passing test and one fake email to the actual recipient; replay unchanged; external facts retained at revision=${controlRevision}`);

   await app.adopt(document);
   const blockedReplay=await app.call('spool.alerts.test',{project,id:destination.id,internal:true,confirmExternal:true,cost:0,idempotency_key:key});
   const replayRevision=app.context.revision;
   assert.deepEqual(blockedReplay._meta?.['com.runeditrun/error'],{code:'policy_blocked',class:'external',rule,revision:replayRevision},'An earlier admitted TEST cannot authorize a replay under a newly blocked policy');
   assert.deepEqual(blockedReplay._meta?.['com.runeditrun/decision'].classes,[{class:'external',rule,do:'blocked',facts}],'Replay preserves the native external facts despite new argument claims');
   assert.deepEqual(await state(),completed,'A newly blocked replay creates no native test, approval or second fake send');
   const replayAudit=(await app.json('/agents/api/audit?agent='+app.context.agentId)).rows.find(row=>row.id===blockedReplay._meta['com.runeditrun/decision'].id);
   assert.equal(replayAudit.revision,replayRevision);assert.equal(replayAudit.code,'policy_blocked');
   assert.deepEqual(replayAudit.classes,classes);assert.deepEqual(replayAudit.rules,[{class:'external',rule,do:'blocked'}]);
   console.log(`PROBE SURFACE-002 acceptance-7-replay ${baseline}: restore external block then replay admitted key with internal and zero-cost claims -> policy_blocked rule=${rule} revision=${replayRevision}; computed external facts and completed native state unchanged`);

   // Configured email destinations hide their recipient in the list response;
   // exact company approval must still show the saved address, never its label.
   const configuredPolicy=policy();configuredPolicy.rules.push({id:'configured-review',class:'external',do:'approval',approver:['sponsor'],wait:'PT1H'});
   await app.adopt(configuredPolicy);
   const beforeConfigured=await state(),configuredKey=randomUUID();
   const configuredCall=await app.call('spool.alerts.test',{project,id:configured.id,idempotency_key:configuredKey});
   const configuredApproval=configuredCall._meta?.['com.runeditrun/approval']??configuredCall._meta?.['com.runeditrun/error']?.approval;
   assert.ok(configuredApproval?.id);
   assert.deepEqual(configuredCall._meta['com.runeditrun/decision'].classes,[{class:'external',rule:'configured-review',do:'approval',facts}]);
   assert.deepEqual({...await state(),approvals:beforeConfigured.approvals},beforeConfigured,'A configured recipient stays inert while waiting for company approval');
   const pendingConfigured=(await app.json('/agents/api/approvals/'+configuredApproval.id)).approval;
   assert.deepEqual(pendingConfigured.summary.recipients,[configured.recipient],'The person reviews the actual configured recipient instead of an internal label claim');
   if(baseline==='held'){
    const screens=await agentScreens(app);
    try{await screens.capture('configured-email-approval','/agents/approvals/'+configuredApproval.id,configured.recipient);}
    finally{await screens.close();}
   }
   await app.json('/agents/api/approvals/'+configuredApproval.id+'/approve','POST',{revision:pendingConfigured.revision,summary_sha256:pendingConfigured.summary_sha256});
   assert.equal((await app.json('/agents/api/approvals/'+configuredApproval.id)).approval.state,'executed');
   const configuredSends=(await app.mail()).filter(row=>row.to?.includes(configured.recipient));
   assert.equal(configuredSends.length,1,'The approved configured target gets exactly one fake TEST');
   const afterConfigured=await state();
   assert.ok(!(await app.call('spool.alerts.test',{project,id:configured.id,idempotency_key:configuredKey})).isError);
   assert.deepEqual(await state(),afterConfigured,'A configured TEST replay makes no second test or send');
   console.log(`PROBE SURFACE-002 acceptance-7-configured ${baseline}: configured mail with an internal label claim -> unchanged external facts; company approval names the saved address; one fake TEST and inert replay`);
   await internalDestinationContract(app,{baseline,policy,project,path,state});
   await changedDestinationContract(app,{baseline,policy,project,path,state,facts});
  }finally{await app.stop();}
 }
}

/** Person edits cannot redirect a TEST that the company already reviewed. */
async function changedDestinationContract(app,{baseline,policy,project,path,state,facts}){
 const claims={internal:true,confirmExternal:true,cost:0,amount:0,currency:'USD'};
 const hold=policy();hold.rules.push({id:'recipient-review',class:'external',do:'approval',approver:['sponsor'],wait:'PT1H'});
 await app.adopt(hold);
 const create=recipient=>app.json(path+'/destinations','POST',{label:'Internal recipient; zero cost',recipient});
 const pending=async destination=>{
  const before=await state(),key=randomUUID();
  const answer=await app.call('spool.alerts.test',{project,id:destination.id,...claims,idempotency_key:key});
  assert.deepEqual(answer._meta['com.runeditrun/decision'].classes,[{class:'external',rule:'recipient-review',do:'approval',facts}]);
  const reference=answer._meta['com.runeditrun/approval']??answer._meta['com.runeditrun/error']?.approval;
  assert.ok(reference?.id);
  assert.deepEqual({...await state(),approvals:before.approvals},before,'An external TEST remains inert until the person approves its actual recipient');
  const approval=(await app.json('/agents/api/approvals/'+reference.id)).approval;
  return {key,approval};
 };
 const approve=async approval=>{
  await app.json('/agents/api/approvals/'+approval.id+'/approve','POST',{revision:approval.revision,summary_sha256:approval.summary_sha256});
  return (await app.json('/agents/api/approvals/'+approval.id)).approval;
 };
 const recipient=['synthetic-spool-5','synthetic.invalid'].join('@'),label='Outside recipient; expensive';
 const labelled=await create(recipient),first=await pending(labelled);
 assert.deepEqual(first.approval.summary.recipients,[recipient]);
 assert.equal((await app.json(path+'/destinations/'+labelled.id,'PUT',{label,recipient})).id,labelled.id,'A text-only edit retains the reviewed native recipient identity');
 const beforeLabelApproval=await state();
 assert.equal((await approve(first.approval)).state,'executed','Changed display text cannot change the reviewed external effect');
 const completed=await state();
 assert.equal(completed.alert_destination_tests.length,beforeLabelApproval.alert_destination_tests.length+1);
 const result=(await app.call('spool.alerts.test',{project,id:labelled.id,...claims,idempotency_key:first.key})).structuredContent;
 assert.ok(result?.id);assert.deepEqual(completed.mail.filter(row=>row.deliveryId===result.id).map(row=>row.to),[[recipient]],'The approved TEST sends once to the address the person reviewed');
 assert.deepEqual(await state(),completed,'Replaying after a label change creates no second TEST or send');

 const original=['synthetic-spool-6','synthetic.invalid'].join('@'),replacement=['synthetic-spool-7','synthetic.invalid'].join('@');
 const target=await create(original),second=await pending(target);
 assert.deepEqual(second.approval.summary.recipients,[original]);
 const changed=await app.json(path+'/destinations/'+target.id,'PUT',{label:'Internal recipient; zero cost',recipient:replacement});
 assert.notEqual(changed.id,target.id,'A changed address replaces the native destination identity');
 const beforeRefusal=await state();
 const refused=await approve(second.approval);
 assert.equal(refused.state,'refused','An old approval cannot send to either the old or the replacement recipient');
 assert.equal(refused.code,'execution_failed');
 assert.deepEqual(await state(),beforeRefusal,'Refused approval creates no TEST, delivery job or provider send');
 const stale=await app.call('spool.alerts.test',{project,id:target.id,...claims,idempotency_key:second.key});
 assert.equal(stale._meta['com.runeditrun/error'].code,'not_found','The old call key cannot revive a replaced recipient');
 assert.deepEqual(await state(),beforeRefusal);

 const blocked=policy();blocked.rules.push({id:'replacement-outside',class:'external',do:'blocked'});
 await app.adopt(blocked);
 const fresh=await app.call('spool.alerts.test',{project,id:changed.id,...claims,idempotency_key:randomUUID()});
 assert.deepEqual(fresh._meta['com.runeditrun/error'],{code:'policy_blocked',class:'external',rule:'replacement-outside',revision:app.context.revision});
 assert.deepEqual(fresh._meta['com.runeditrun/decision'].classes,[{class:'external',rule:'replacement-outside',do:'blocked',facts}],'The replacement recipient is classified afresh despite internal and zero-cost claims');
 assert.deepEqual(await state(),beforeRefusal);
 await app.adopt(hold);
 const third=await pending(changed);
 assert.deepEqual(third.approval.summary.recipients,[replacement],'Fresh approval names the replacement address');
 assert.equal((await approve(third.approval)).state,'executed');
 const afterReplacement=await state();
 assert.equal(afterReplacement.alert_destination_tests.length,beforeRefusal.alert_destination_tests.length+1);
 const replay=await app.call('spool.alerts.test',{project,id:changed.id,...claims,idempotency_key:third.key});
 assert.ok(!replay.isError);assert.ok(replay.structuredContent?.id);
 assert.deepEqual(afterReplacement.mail.filter(row=>row.deliveryId===replay.structuredContent.id).map(row=>row.to),[[replacement]],'Only a fresh approval can send once to the replacement');
 assert.ok(!afterReplacement.mail.some(row=>row.to?.includes(original)),'The retired original recipient receives no TEST');
 assert.deepEqual(await state(),afterReplacement,'Completed replacement replay remains inert');
 console.log(`PROBE SURFACE-002 acceptance-7-recipient-change ${baseline}: MCP spool.alerts.test and native destination edit -> label-only change preserves one approved send; address change retires the target and refuses old approval and replay with no send; fresh replacement is externally blocked despite injected claims, then sends once only after fresh exact approval`);
}
