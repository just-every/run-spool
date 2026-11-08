import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs';

/** A policy refusal retains native suppression facts without executing or reserving usage. */
export async function classificationAuditContract(app,{project,issue}){
 const tool='spool.issues.update';
 const expectedClasses=[{class:'live',facts:{measure:1,service:project}}];
 const auditRows=async()=>{
  const rows=[];let after='0';
  for(;;){
   const page=await app.json('/agents/api/audit?after='+after);
   assert.equal(page.differs_from_policy,0,'Retained audit decisions reconcile with their signed policy');
   rows.push(...page.rows);
   if(!page.rows.length)return rows;
   assert.notEqual(page.cursor,after,'Audit pagination advances');after=page.cursor;
  }
 };
 const snapshot=async()=>{
  const result={issueList:await app.json(`/api/projects/${project}/issues`)};
  for(const table of ['events','event_grouping','issues','issue_resolutions','alerts','alert_intents','alert_mail_jobs','alert_history','outcomes','spool_agent_operations','spool_agent_custody']){
   result[table]=(await app.DB.prepare(`SELECT * FROM ${table} WHERE project=? ORDER BY rowid`).bind(project).all()).results;
  }
  result.attempts=(await app.DB.prepare('SELECT a.* FROM alert_mail_attempts a JOIN alert_mail_jobs j ON j.id=a.delivery_id WHERE j.project=? ORDER BY a.rowid').bind(project).all()).results;
  for(const table of ['agent_door_usage','agent_door_calls','agent_door_approvals','agent_door_reviews','agent_door_events']){
   result[table]=(await app.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
  }
  result.mail=await app.mail();return result;
 };
 const fixture=(await app.json(`/api/projects/${project}/issues`)).find(row=>row.id===issue);
 assert.ok(fixture&&fixture.count>0,'Prepare an existing captured issue through its native owner door');
 await app.json(`/api/projects/${project}/issues/${issue}`,'PATCH',{state:'open',revision:fixture.revision});
 for(const [baseline,makePolicy] of [['autonomous',autonomousPolicy],['held',heldPolicy]]){
  const policy=makePolicy(),rule='synthetic-spool-live-'+baseline;
  policy.rules.push({id:rule,class:'live',do:'blocked'});
  const revision=app.context.revision+1;
  await app.adopt(policy,{revision});
  const current=(await app.json(`/api/projects/${project}/issues`)).find(row=>row.id===issue);
  assert.ok(current&&current.count>0,'Suppression refusal targets a populated native issue');
  assert.equal(current.state,'open','The fixture has not already suppressed the issue');
  const args={project,issue,state:'suppressed',revision:current.revision,idempotency_key:randomUUID()};
  const before=await snapshot(),priorAudit=await auditRows();
  assert.ok(before.events.some(row=>row.issue===issue),'Occurrence membership is nonempty before refusal');
  assert.ok(before.alert_mail_jobs.length>0,'Delivery preservation is checked against real native jobs');
  assert.ok(before.agent_door_usage.length>0,'Refusal cannot erase or add to existing execution usage');
  const answer=await app.call(tool,args);
  assert.equal(answer.isError,true);
  assert.deepEqual(answer._meta['com.runeditrun/error'],{code:'policy_blocked',class:'live',rule,revision},'The explicit live rule wins over either baseline');
  const decision=answer._meta['com.runeditrun/decision'];
  assert.ok(decision?.id,'The refusal returns its own decision identity');
  assert.deepEqual({disposition:decision.disposition,revision:decision.revision,classes:decision.classes},{
   disposition:'blocked',revision,classes:[{...expectedClasses[0],rule,do:'blocked'}],
  },'The returned classification equals independent native fixture expectations');
  const afterAudit=await auditRows(),matches=afterAudit.filter(row=>row.id===decision.id);
  assert.equal(matches.length,1,'Find exactly the returned decision, never an arbitrary refusal row');
  const [row]=matches;
  assert.deepEqual(row.classes,expectedClasses,'Refused audit retains live, one affected item and the native project');
  assert.deepEqual(row.rules,[{class:'live',rule,do:'blocked'}],'Refused audit retains the independently expected live rule');
  assert.equal(row.revision,revision,'Refused audit retains the adopted fixture revision');
  assert.equal(row.decision,'blocked');assert.equal(row.outcome,'refused');assert.equal(row.code,'policy_blocked');
  assert.equal(row.tool,tool);assert.equal(row.door,'mcp');assert.equal(row.idempotency_key,args.idempotency_key);
  assert.equal(row.agent.id,app.context.agentId);assert.equal(row.consent,app.context.consent);
  assert.equal(row.approval,null,'Blocked suppression opens no approval');assert.equal(row.review,null,'Blocked suppression opens no review');
  assert.deepEqual(afterAudit.filter(item=>item.id!==decision.id),priorAudit,'Only the required refusal audit is added');
  assert.deepEqual(await snapshot(),before,'Refusal preserves occurrence membership, full issues and revisions, deliveries, native work and usage');
  console.log(`PROBE BASE-AGENT-006 acceptance-6-${baseline}: MCP suppression at current native revision with explicit live block -> policy_blocked; exact decision audit has live, measure 1, native project, rule ${rule}, revision ${revision} and refused outcome; captured state, delivery jobs and usage unchanged`);
 }
 await app.adopt();
}
