import {auditedBatch,auditCommit} from '../audit/context';
import {serviceActor,auditSubject,projectAuditLabel} from '../audit/identity';
import {s} from '../operators/common';
import {userCountSql} from './model';

export async function scheduleSuppression(env:{DB:D1Database},time:number){
 if(!Number.isSafeInteger(time)||time<0)throw new Error('Invalid suppression schedule time');
 const rows=(await s(env.DB,`SELECT z.*,i.revision FROM issue_suppressions z JOIN issues i ON i.project=z.project AND i.id=z.issue
  WHERE z.state='active' AND z.historical=0 AND i.state='suppressed' AND z.mode<>'forever' ORDER BY z.started,z.id`).all<any>()).results;
 for(const row of rows){
  const eligible=`CASE mode
   WHEN 'until' THEN deadline<=? WHEN 'snooze' THEN deadline<=?
   WHEN 'count' THEN (SELECT count FROM issues WHERE project=issue_suppressions.project AND id=issue_suppressions.issue)>=occurrence_target
   WHEN 'users' THEN ${userCountSql('issue_suppressions.project','issue_suppressions.issue')}>=user_target
   WHEN 'escalating' THEN (SELECT COUNT(*) FROM events e WHERE e.project=issue_suppressions.project AND e.issue=issue_suppressions.issue AND e.received>?-window_ms AND e.received<=?)>forecast
   ELSE 0 END`;
  // The winning state transition is the witness carried by changes() through
  // reopening, history and attention. Concurrent ticks commit exactly once.
  const actor=await serviceActor(env.DB,'alerts'),scope={actor,action:'automation.follow_up' as const,
   subject:await auditSubject(env.DB,'issue',row.issue,row.project),projectLabel:await projectAuditLabel(env.DB,row.project)};
  const detail=JSON.stringify({suppression:row.id,mode:row.mode,reason:row.reason,forecast:row.forecast,occurrenceTarget:row.occurrence_target,userTarget:row.user_target});
  await auditedBatch(env.DB,[
   s(env.DB,`UPDATE issue_suppressions SET state='expired',ended=? WHERE id=? AND project=? AND state='active' AND historical=0 AND ${eligible}
    AND EXISTS(SELECT 1 FROM issues WHERE project=issue_suppressions.project AND id=issue_suppressions.issue AND state='suppressed' AND revision=?)`,time,row.id,row.project,time,time,time,time,row.revision),
   s(env.DB,"UPDATE issues SET state='open',revision=revision+1 WHERE project=? AND id=? AND state='suppressed' AND revision=? AND changes()=1",row.project,row.issue,row.revision),
   s(env.DB,`INSERT INTO issue_activity(id,project,issue,kind,actor_kind,actor_label,detail,created)
    SELECT ?,?,?,'suppression_expired',?,?,?,? WHERE changes()=1`,crypto.randomUUID(),row.project,row.issue,actor.kind,actor.label,detail,time),
   s(env.DB,`INSERT INTO follow_up_attention(id,project,source,source_id,due,state,reason,created,updated)
    SELECT ?,?,'alert',?,?,'overdue','suppression_expired',?,? WHERE changes()=1 ON CONFLICT(project,source,source_id) DO NOTHING`,crypto.randomUUID(),row.project,'suppression:'+row.id,time,time,time),
   auditCommit(env.DB,'changes()=1'),
  ],scope);
 }
}
