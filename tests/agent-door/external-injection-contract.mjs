import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';
import {internalDestinationContract} from './internal-destination-contract.mjs';

/** Native email classification under refusal, with policy admission controls. */
export async function externalInjectionContract(){
 for(const [baseline,policy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const app=await agentRuntime(0);
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
   const refused=async(name,extra={})=>{
    const before=await state(),key=randomUUID();
    assert.ok(!keys.has(key));keys.add(key);
    const answer=await app.call('spool.alerts.test',{project,id:destination.id,...extra,idempotency_key:key});
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
    assert.deepEqual(row.resource,{kind:'alert_destination',id:destination.id});
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
   await internalDestinationContract(app,{baseline,policy,project,path,state});
  }finally{await app.stop();}
 }
}
