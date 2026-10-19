import { auditCommit, auditedBatch } from '../audit/context';
import { auditSubject, projectAuditLabel, serviceActor } from '../audit/identity';
import { s, type Environment } from './types';
type Candidate={project:string;source:'alert'|'deployment'|'fix';source_id:string;due:number;state:string;reason:string};

async function remember(env:Environment,row:Candidate,time:number) {
 const scope={actor:await serviceActor(env.DB,'alerts'),action:'automation.follow_up' as const,
  subject:await auditSubject(env.DB,'run',JSON.stringify([row.project,row.source,row.source_id]),row.project),projectLabel:await projectAuditLabel(env.DB,row.project)};
 // The uniqueness constraint arbitrates overlapping ticks. The winning insert
 // commits exactly one permanent fact in this same transaction.
 await auditedBatch(env.DB,[
  s(env.DB,`INSERT INTO follow_up_attention(id,project,source,source_id,due,state,reason,created,updated)
   VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project,source,source_id) DO NOTHING`,crypto.randomUUID(),row.project,row.source,row.source_id,row.due,row.state,row.reason,time,time),
  auditCommit(env.DB,'changes()=1'),
 ],scope);
}

/** One installation-wide scan, independent of the alert dispatch cursor. */
export async function scanFollowUp(env:Environment,time:number) {
 if(!Number.isSafeInteger(time)||time<0)throw new Error('Invalid follow-up time');
 // Expired provider boundaries never become retryable merely because a lease
 // disappeared. A delayed old worker may still finish; uncertainty stays fenced.
 await s(env.DB,"UPDATE follow_up_fix_steps SET state='uncertain',finished=? WHERE state='running' AND due<=?",time,time).run();
 const candidates=(await s(env.DB,`SELECT * FROM (
  SELECT h.project,'alert' source,h.id source_id,
   CASE WHEN h.state='accepted' THEN h.created+86400000 ELSE h.created+300000 END due,
   CASE WHEN h.state='uncertain' THEN 'uncertain' WHEN h.state='blocked' THEN 'blocked' WHEN h.state='rejected' THEN 'failed' ELSE 'overdue' END state,
   CASE WHEN h.state='accepted' THEN 'unacknowledged' WHEN h.state IN ('pending','queued','sending','retrying') THEN 'send_overdue' ELSE COALESCE(h.code,'delivery_failed') END reason
  FROM alert_history h JOIN alerts a ON a.id=h.alert_id JOIN issues i ON i.id=a.issue AND i.project=h.project
  WHERE h.historical=0 AND (h.state IN ('blocked','rejected','uncertain') OR
   (h.state IN ('pending','queued','sending','retrying') AND h.created+300000<=?) OR
   (h.state='accepted' AND i.state='open' AND h.created+86400000<=?))
  UNION ALL
  SELECT a.project,'alert','feed:'||a.id,a.created+86400000,'overdue','unacknowledged_feed'
   FROM alerts a JOIN issues i ON i.id=a.issue AND i.project=a.project
   WHERE i.state='open' AND a.created+86400000<=? AND NOT EXISTS(SELECT 1 FROM alert_history h WHERE h.alert_id=a.id)
   AND EXISTS(SELECT 1 FROM follow_up_feed_custody f WHERE f.alert=a.id AND f.project=a.project)
  UNION ALL
  SELECT n.project,'deployment',n.deployment,r.deadline,
   CASE WHEN n.state='uncertain' THEN 'uncertain' WHEN n.state='blocked' THEN 'blocked' WHEN n.state='rejected' THEN 'failed' ELSE 'overdue' END,
   CASE WHEN n.state IN ('uncertain','blocked','rejected') THEN 'deadline_notice_'||n.state ELSE 'deployment_overdue' END
  FROM deployment_notices n JOIN deployment_runs r ON r.project=n.project AND r.id=n.deployment
  WHERE r.historical=0 AND r.deadline<=? AND (n.state IN ('blocked','uncertain','rejected','pending') OR
   (SELECT state FROM deployment_steps WHERE project=r.project AND deployment=r.id ORDER BY sequence DESC LIMIT 1)='timed_out')
  UNION ALL
  SELECT l.project,'fix',l.workflow,l.until,'uncertain','step_lease_expired' FROM fix_leases l WHERE l.until<=?
  UNION ALL
  SELECT f.project,'fix',f.workflow,f.due,CASE WHEN f.state='uncertain' THEN 'uncertain' ELSE 'failed' END,'provider_'||f.state
   FROM follow_up_fix_steps f WHERE f.state IN ('uncertain','rejected')
  ) candidate WHERE NOT EXISTS(SELECT 1 FROM follow_up_attention a WHERE a.project=candidate.project AND a.source=candidate.source AND a.source_id=candidate.source_id)
  ORDER BY due,project,source,source_id`,time,time,time,time,time).all<Candidate>()).results;
 // Do not bound this scan to the first N failures: durable failures would starve
 // every later source forever. Existing project/workflow admission bounds work.
 const seen=new Set<string>();
 for(const row of candidates){const key=JSON.stringify([row.project,row.source,row.source_id]);if(seen.has(key))continue;seen.add(key);await remember(env,row,time);}
 // Reuses the same durable attention identity after an authorized attempt.
 // In particular a queued resend which loses its answer becomes uncertain;
 // it must not sit behind a misleading "queued" label forever.
 await s(env.DB,`UPDATE follow_up_attention SET state=(SELECT CASE h.state WHEN 'uncertain' THEN 'uncertain' WHEN 'blocked' THEN 'blocked' WHEN 'rejected' THEN 'failed' WHEN 'cancelled' THEN 'canceled' WHEN 'accepted' THEN 'completed' ELSE 'queued' END FROM alert_history h WHERE h.id=source_id),updated=?,revision=revision+1
  WHERE source='alert' AND historical=0 AND state='queued' AND EXISTS(SELECT 1 FROM alert_history h WHERE h.id=source_id AND h.state NOT IN ('pending','queued','sending','retrying'))`,time).run();
 await s(env.DB,`UPDATE follow_up_attention SET state='uncertain',reason='provider_uncertain',updated=?,revision=revision+1
  WHERE source='fix' AND historical=0 AND state<>'uncertain' AND EXISTS(SELECT 1 FROM follow_up_fix_steps f WHERE f.workflow=source_id AND f.state='uncertain')`,time).run();
 await s(env.DB,`UPDATE follow_up_attention SET state=(SELECT CASE n.state WHEN 'uncertain' THEN 'uncertain' WHEN 'blocked' THEN 'blocked' WHEN 'rejected' THEN 'failed' ELSE 'overdue' END FROM deployment_notices n WHERE n.project=follow_up_attention.project AND n.deployment=source_id),updated=?,revision=revision+1
  WHERE source='deployment' AND historical=0 AND state='queued' AND EXISTS(SELECT 1 FROM deployment_notices n WHERE n.project=follow_up_attention.project AND n.deployment=source_id AND n.state<>'pending')`,time).run();
 // Source completion closes work without fabricating delivery of an uncertain
 // effect. An uncertain transport is closed only by an explicit owner decision.
 await s(env.DB,`UPDATE follow_up_attention SET state='completed',updated=?,revision=revision+1 WHERE historical=0 AND state NOT IN ('completed','canceled','uncertain') AND (
  (source='alert' AND source_id LIKE 'feed:%' AND EXISTS(SELECT 1 FROM alerts a JOIN issues i ON i.id=a.issue WHERE 'feed:'||a.id=source_id AND i.state<>'open')) OR
  (source='alert' AND EXISTS(SELECT 1 FROM alert_history h JOIN alerts a ON a.id=h.alert_id JOIN issues i ON i.id=a.issue WHERE h.id=source_id AND h.project=follow_up_attention.project AND (h.state='cancelled' OR (h.state='accepted' AND (reason<>'unacknowledged' OR i.state<>'open'))))) OR
  (source='deployment' AND (SELECT state FROM deployment_steps WHERE project=follow_up_attention.project AND deployment=source_id ORDER BY sequence DESC LIMIT 1) IN ('succeeded','failed','rolled_back'))
 )`,time).run();
}
