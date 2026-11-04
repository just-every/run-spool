import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentRuntime} from './runtime.mjs';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** Qualify only policy-refused native email tests, with independent policy fixtures. */
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
  }finally{await app.stop();}
 }
}
