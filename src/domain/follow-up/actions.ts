import { auditCommit } from '../audit/context';
import { ownerWrites } from '../owner-router';
import { s, type Attention } from './types';
const code=(value:unknown):value is string=>typeof value==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(value);

function fixResult(step:any,body:any,workflow:any) {
 const grant=JSON.parse(workflow.grant_spec),result=body.result;
 if(step.step==='open_draft_pull_request'){
  if(!result||!Number.isSafeInteger(result.number)||result.number<1||typeof result.url!=='string'||result.url!==`https://github.com/${grant.repository}/pull/${result.number}`||!/^([a-f0-9]{40})$/.test(result.head))throw new Error('Accepted pull request reconciliation requires result {number,url,head} from the provider.');
  return {number:result.number,url:result.url,head:result.head,draft:true};
 }
 if(step.step==='create_branch'){
  if(!result||!/^[a-f0-9]{40}$/.test(result.sha))throw new Error('Accepted branch reconciliation requires result {sha} from the provider.');
  return {ref:'refs/heads/'+grant.branch,sha:result.sha};
 }
 if(step.step==='commit_file'){
  if(!result||!/^[a-f0-9]{40}$/.test(result.commit))throw new Error('Accepted file reconciliation requires result {commit} from the provider.');
  return {path:grant.file.path,commit:result.commit};
 }
 // An expired old lease does not identify which mutation crossed its boundary.
 // A bare assertion of acceptance cannot establish branch/file/PR identity.
 if(step.step==='expired_lease')throw new Error('This expired lease has no provider result. Explicitly authorize a resend after inspecting the provider; acceptance alone cannot recover the missing result.');
 return null;
}

/** Each explicit decision changes the source and attention under one owner
 * authority/CAS fence; stale tabs cannot authorize a second replay. */
export async function attentionAction(c:any,row:Attention,body:any,resend:boolean) {
 if(!Number.isSafeInteger(body.revision)||!code(body.evidence)||(!resend&&!['accepted','rejected'].includes(body.state)))throw new Error('A revision and safe evidence code are required.');
 if(row.historical||row.revision!==body.revision||['completed','canceled','queued','running'].includes(row.state))return c.json({error:'Follow-up changed; refresh before deciding.'},409);
 const db=c.env.DB,time=Date.now(),statements:D1PreparedStatement[]=[];
 let targetState=resend?'queued':body.state==='accepted'?'completed':'failed';
 if(row.source==='alert'){
  if(row.source_id.startsWith('suppression:')){
   if(resend||body.state!=='accepted')return c.json({error:'Review the reopened issue before completing this follow-up.'},409);
   await ownerWrites(c,[s(db,"UPDATE follow_up_attention SET state='completed',revision=revision+1,updated=? WHERE id=? AND project=? AND revision=? AND historical=0",time,row.id,row.project,body.revision),s(db,'INSERT INTO spool_authority_guards SELECT CASE WHEN changes()=1 THEN 1 ELSE 0 END'),auditCommit(db)]);
   return c.json({resolved:true,replayed:false});
  }
  if(row.source_id.startsWith('feed:')){
   if(resend||body.state!=='accepted')return c.json({error:'This alert has no delivery rule. Review the issue and reconcile it as accepted; configure a rule for future alerts.'},409);
   await ownerWrites(c,[s(db,"UPDATE follow_up_attention SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?",time,row.id,body.revision),auditCommit(db,'changes()=1')]);
   return c.json({resolved:true,replayed:false});
  }
  const h=await s(db,'SELECT * FROM alert_history WHERE id=? AND project=? AND historical=0',row.source_id,row.project).first<any>();
  if(!h)return c.json({error:'Live delivery not found'},409);
  if(!resend&&h.state!=='uncertain'){
   if(body.state==='accepted'&&row.reason==='unacknowledged'&&h.state==='accepted'){
    await ownerWrites(c,[s(db,"UPDATE follow_up_attention SET state='completed',revision=revision+1,updated=? WHERE id=? AND revision=?",time,row.id,body.revision),auditCommit(db,'changes()=1')]);
    return c.json({resolved:true,replayed:false});
   }
   return c.json({error:'Only uncertain deliveries need reconciliation.'},409);
  }
  if(resend){
   if(!['uncertain','blocked','rejected','pending','retrying','queued'].includes(h.state))return c.json({error:'This delivery has no resendable failure.'},409);
   if(!await s(db,'SELECT 1 FROM alert_intents i JOIN alert_rules r ON r.id=i.rule_id AND r.project=i.project AND r.revision=i.rule_revision AND r.enabled=1 WHERE i.id=?',row.source_id).first())return c.json({error:'The original rule is revoked. Enable a new rule for future alerts.'},409);
  }
  if(h.channel==='mail'){
   const job=await s(db,'SELECT * FROM alert_mail_jobs WHERE id=?',row.source_id).first<any>();
   if(job){
    if(resend&&job.attempts>=10)return c.json({error:'This delivery reached its bounded attempt limit.'},409);
    statements.push(s(db,resend?"UPDATE alert_mail_jobs SET state='queued',code=?,next_at=?,claim=NULL,claim_until=NULL,max_attempts=MAX(max_attempts,attempts+1) WHERE id=? AND state<>'sending'":'UPDATE alert_mail_jobs SET state=?,code=?,claim=NULL,claim_until=NULL WHERE id=? AND state=\'uncertain\'',...(resend?[body.evidence,time,row.source_id]:[body.state,body.evidence,row.source_id])));
   }
  }else{
   const delivery=await s(db,"SELECT * FROM integration_deliveries WHERE namespace='spool.'||? AND id=?",row.project,row.source_id).first<any>();
   if(delivery){
    if(resend&&delivery.attempts>=10)return c.json({error:'This delivery reached its bounded attempt limit.'},409);
    statements.push(s(db,"INSERT INTO integration_resolutions(namespace,id,delivery_id,at,outcome) SELECT namespace,?,id,?,? FROM integration_deliveries WHERE namespace='spool.'||? AND id=? AND state='uncertain'",crypto.randomUUID(),time,JSON.stringify({kind:resend?'rejected':body.state,code:body.evidence}),row.project,row.source_id));
    statements.push(s(db,resend?"UPDATE integration_deliveries SET state='queued',next_at=?,claim=NULL,claim_until=NULL,max_attempts=MAX(max_attempts,attempts+1) WHERE namespace='spool.'||? AND id=? AND state<>'sending'":"UPDATE integration_deliveries SET state=?,claim=NULL,claim_until=NULL WHERE namespace='spool.'||? AND id=? AND state='uncertain'",resend?time:body.state,row.project,row.source_id));
   }
  }
  if(resend)statements.push(s(db,"UPDATE alert_intents SET state='pending',code=NULL WHERE id=? AND expanded=0 AND state IN ('pending','blocked')",row.source_id));
  statements.push(s(db,'UPDATE alert_history SET state=?,code=?,updated=? WHERE id=? AND historical=0',resend?'queued':body.state,body.evidence,time,row.source_id));
 }else if(row.source==='deployment'){
  const notice=await s(db,'SELECT state FROM deployment_notices WHERE project=? AND deployment=?',row.project,row.source_id).first<any>();
  if(!notice||(!resend&&notice.state!=='uncertain'&&!(body.state==='accepted'&&row.state==='overdue'))||(resend&&!['blocked','rejected','uncertain'].includes(notice.state)))return c.json({error:'This deadline notice has no reconcilable send.'},409);
  if(resend||notice.state==='uncertain')statements.push(s(db,'UPDATE deployment_notices SET state=?,updated=? WHERE project=? AND deployment=?',resend?'pending':body.state,time,row.project,row.source_id));
 }else{
  const steps=(await s(db,"SELECT * FROM follow_up_fix_steps WHERE workflow=? AND state IN ('running','uncertain','rejected') ORDER BY started,id",row.source_id).all<any>()).results;
  if(steps.some(step=>step.state==='running'))return c.json({error:'The provider step still holds a live boundary.'},409);
  const workflow=await s(db,'SELECT * FROM fix_workflows WHERE id=? AND project=?',row.source_id,row.project).first<any>();
  if(!workflow)return c.json({error:'Workflow no longer exists'},409);
  if(!resend&&!steps.length)return c.json({error:'An expired lease does not identify the provider effect. Inspect the provider and explicitly authorize a resend.'},409);
  if(!resend&&body.state==='accepted')for(const step of steps.filter(step=>step.state==='uncertain')){
   const result=fixResult(step,body,workflow);
   if(result)statements.push(s(db,'INSERT INTO fix_receipts VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),workflow.id,row.project,step.step,step.method,step.target,'succeeded',200,JSON.stringify(result),time));
  }
  statements.push(s(db,'DELETE FROM fix_leases WHERE workflow=? AND until<=?',row.source_id,time));
  statements.push(s(db,"UPDATE follow_up_fix_steps SET state=?,evidence=?,finished=COALESCE(finished,?) WHERE workflow=? AND state IN ('uncertain','rejected')",resend?'authorized':body.state==='accepted'?'completed':'rejected',body.evidence,time,row.source_id));
  // This door authorizes the next explicit Advance under its still-valid grant;
  // it never starts a GitHub operation in the background.
  if(resend)targetState='completed';
 }
 await ownerWrites(c,[
  s(db,'UPDATE follow_up_attention SET state=?,revision=revision+1,updated=? WHERE id=? AND project=? AND revision=? AND historical=0',targetState,time,row.id,row.project,body.revision),
  s(db,'INSERT INTO spool_authority_guards SELECT CASE WHEN changes()=1 THEN 1 ELSE 0 END'),
  ...statements,auditCommit(db),
 ]);
 return c.json({resolved:!resend,authorized:resend,replayed:false,next:resend?(row.source==='fix'?'advance_workflow':'scheduled_dispatch'):null});
}
