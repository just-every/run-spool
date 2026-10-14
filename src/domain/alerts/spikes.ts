import type { AlertEnvironment, Rule } from './types';
import { statement as s } from './types';
import { routeStatements } from './admission';
import { issueLink, publicOrigin } from './payload';
import { hash } from '../privacy';
const eligible="e.historical=0 AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence) AND NOT EXISTS(SELECT 1 FROM event_grouping g WHERE g.project=e.project AND g.event=e.id AND g.occurrence=e.occurrence)";
const windowCount=`(SELECT COUNT(*) FROM events e WHERE e.project=issues.project AND e.issue=issues.id AND ${eligible} AND e.received>=? AND e.received<?)`;
export async function evaluateSpikes(env:AlertEnvironment,time:number) {
 const cursor=await s(env.DB,'SELECT last_spike_rule FROM alert_scheduler WHERE id=1').first<{last_spike_rule:string}>();
 const rules=(await s(env.DB,`SELECT r.*,c.next_start FROM alert_rules r JOIN alert_cursors c ON c.rule_id=r.id AND c.revision=r.revision
 WHERE r.enabled=1 AND c.next_start+r.window_ms<=? ORDER BY CASE WHEN r.id>? THEN 0 ELSE 1 END,r.id LIMIT 20`,time,cursor?.last_spike_rule??'').all<Rule&{next_start:number}>()).results;
 for(const rule of rules) {
  // Persist every window before moving to the next. A later schedule resumes bounded catch-up.
  for(let turn=0,start=rule.next_start;turn<4&&start+rule.window_ms<=time;turn++,start+=rule.window_ms) {
   const end=start+rule.window_ms;
   const issues=(await s(env.DB,`SELECT i.id,COUNT(*) count FROM events e JOIN issues i ON i.id=e.issue AND i.project=e.project
    WHERE e.project=? AND ${eligible} AND e.received>=? AND e.received<? AND i.algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1') AND i.state<>'suppressed' GROUP BY i.id HAVING COUNT(*)>=?`,rule.project,start,end,rule.threshold).all<{id:string;count:number}>()).results;
   const jobs:D1PreparedStatement[]=[];
   for(const issue of issues) {
    const id=await hash(JSON.stringify(['spike',rule.id,rule.revision,issue.id,start]));
    const payload=JSON.stringify({schema:'spool.alert.v1',alertId:id,kind:'spike',projectId:rule.project,issueId:issue.id,occurredAt:new Date(end).toISOString(),release:null,issueUrl:issueLink(publicOrigin(env.ALERT_PUBLIC_ORIGIN),rule.project,issue.id),window:{start:new Date(start).toISOString(),end:new Date(end).toISOString(),durationMs:rule.window_ms,count:issue.count,threshold:rule.threshold},rule:{id:rule.id,revision:rule.revision}});
    // The cursor fences erased window evidence, but retention can also change a
    // headline from an earlier occurrence outside this wholly retained window.
    // Read that diagnostic text in the admission transaction, never before it.
    jobs.push(s(env.DB,`INSERT INTO alerts(id,project,issue,kind,created,payload) SELECT ?,project,id,'spike',?,json_set(?,'$.title',title,'$.window.count',${windowCount})
     FROM issues WHERE id=? AND project=? AND algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1') AND state<>'suppressed'
     AND ${windowCount}>=?
     AND EXISTS(SELECT 1 FROM alert_cursors c JOIN alert_rules r ON r.id=c.rule_id AND r.revision=c.revision WHERE c.rule_id=? AND c.revision=? AND c.next_start=? AND r.enabled=1)
     ON CONFLICT(id) DO NOTHING`,id,end,payload,start,end,issue.id,rule.project,start,end,rule.threshold,rule.id,rule.revision,start),...routeStatements(env.DB,id,time,rule.id));
   }
   jobs.push(s(env.DB,`UPDATE alert_cursors SET next_start=? WHERE rule_id=? AND revision=? AND next_start=? AND EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND enabled=1 AND revision=?)`,end,rule.id,rule.revision,start,rule.id,rule.revision));
   jobs.push(s(env.DB,'UPDATE alert_scheduler SET last_spike_rule=? WHERE id=1',rule.id));
   await env.DB.batch(jobs);
  }
 }
}
// Retention must visibly invalidate every possibly partial window before evidence disappears.
export function retentionAlertStatements(db:D1Database,project:string,cutoff:number,time:number) {
 return [s(db,`INSERT INTO audit(id,project,kind,detail,created)
 SELECT lower(hex(randomblob(16))),project,'alert_history_unavailable',json_object('rule',rule_id,'revision',revision,'from',next_start,'cutoff',?),?
 FROM alert_cursors WHERE project=? AND next_start<?`,cutoff,time,project,cutoff),
 s(db,`UPDATE alert_cursors SET next_start=(SELECT CAST((?+window_ms-1)/window_ms AS INTEGER)*window_ms FROM alert_rules WHERE id=rule_id)
 WHERE project=? AND next_start<?`,cutoff,project,cutoff)];
}
