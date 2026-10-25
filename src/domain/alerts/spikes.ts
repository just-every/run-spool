import type { AlertEnvironment, Rule } from './types';
import { statement as s } from './types';
import { routeStatements } from './admission';
import { issueLink, publicOrigin } from './payload';
import { hash } from '../privacy';
import { primaryShortIdSql } from '../short-ids/lookup';
import { configSql } from './preview';
import { eligibleEvent,eventFilter,ruleConfig } from './filters';
import { decision } from './measure';
import { readIdentityPolicy,identityPolicyFence } from '../identities/policy';
export async function evaluateSpikes(env:AlertEnvironment,time:number) {
 const cursor=await s(env.DB,'SELECT last_spike_rule FROM alert_scheduler WHERE id=1').first<{last_spike_rule:string}>();
 const rules=(await s(env.DB,`SELECT r.*,${configSql} config,c.next_start FROM alert_rules r JOIN alert_cursors c ON c.rule_id=r.id AND c.revision=r.revision WHERE r.enabled=1 AND c.next_start+r.window_ms<=? ORDER BY CASE WHEN r.id>? THEN 0 ELSE 1 END,r.id LIMIT 20`,time,cursor?.last_spike_rule??'').all<Rule&{next_start:number}>()).results;
 for(const rule of rules){
  const config=ruleConfig(JSON.parse(rule.config)),f=eventFilter(config),policy=await readIdentityPolicy(env.DB,rule.project);
  for(let turn=0,start=rule.next_start;turn<4&&start+rule.window_ms<=time;turn++,start+=rule.window_ms){
   const end=start+rule.window_ms,issues=(await s(env.DB,`SELECT DISTINCT i.id FROM events e JOIN issues i ON i.id=e.issue AND i.project=e.project WHERE e.project=? AND ${eligibleEvent()} AND e.received>=? AND e.received<? AND ${f.sql} AND i.state<>'suppressed' ORDER BY i.id LIMIT 100`,rule.project,config.metric==='baseline'?start-8*7*86400000:start,end,...f.args).all<{id:string}>()).results;
   const jobs:D1PreparedStatement[]=[];
   for(const issue of config.metric==='session_percent'?issues.slice(0,1):issues){
    const d=await decision(env.DB,rule.project,config,issue.id,start,end,rule.threshold),id=await hash(JSON.stringify(['spike',rule.id,rule.revision,issue.id,start]));
    const authority=`EXISTS(SELECT 1 FROM alert_cursors c JOIN alert_rules r ON r.id=c.rule_id AND r.revision=c.revision WHERE c.rule_id=? AND c.revision=? AND c.next_start=? AND r.enabled=1)`;
    const args=[rule.id,rule.revision,start];
    jobs.push(identityPolicyFence(env.DB,rule.project,policy.revision));
    // Recheck the retained filtered evidence inside the admission transaction.
    jobs.push(s(env.DB,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN (SELECT COUNT(*) FROM events e WHERE e.project=? AND e.issue=? AND ${eligibleEvent()} AND e.received>=? AND e.received<? AND ${f.sql})=? THEN 1 ELSE 0 END`,rule.project,issue.id,start,end,...f.args,d.count));
    jobs.push(s(env.DB,`INSERT INTO alert_decisions SELECT ?,?,?,?,?,?,?,?,? WHERE ${authority} ON CONFLICT(id) DO NOTHING`,id,rule.project,rule.id,rule.revision,issue.id,start,end,Number(d.fired),JSON.stringify(d),...args));
    if(d.fired){
     const payload=JSON.stringify({schema:'spool.alert.v1',alertId:id,kind:'spike',projectId:rule.project,issueId:issue.id,occurredAt:new Date(end).toISOString(),release:null,issueUrl:issueLink(publicOrigin(env.ALERT_PUBLIC_ORIGIN??env.AUTH_ORIGIN),rule.project,issue.id),window:{start:new Date(start).toISOString(),end:new Date(end).toISOString(),durationMs:rule.window_ms,count:d.count,threshold:rule.threshold,decision:d},rule:{id:rule.id,revision:rule.revision}});
     jobs.push(s(env.DB,`INSERT INTO alerts(id,project,issue,kind,created,payload) SELECT ?,project,id,'spike',?,json_set(?,'$.title',title,'$.shortId',${primaryShortIdSql('issues')}) FROM issues WHERE id=? AND project=? AND state<>'suppressed' AND ${authority} ON CONFLICT(id) DO NOTHING`,id,end,payload,issue.id,rule.project,...args),...routeStatements(env.DB,id,time,rule.id));
    }
   }
   jobs.push(s(env.DB,`UPDATE alert_cursors SET next_start=? WHERE rule_id=? AND revision=? AND next_start=? AND EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND enabled=1 AND revision=?)`,end,rule.id,rule.revision,start,rule.id,rule.revision),s(env.DB,'UPDATE alert_scheduler SET last_spike_rule=? WHERE id=1',rule.id),s(env.DB,'DELETE FROM spool_authority_guards'));
   await env.DB.batch(jobs);
  }
 }
}
export function retentionAlertStatements(db:D1Database,project:string,cutoff:number,time:number) {
 return [s(db,`INSERT INTO audit(id,project,kind,detail,created) SELECT lower(hex(randomblob(16))),project,'alert_history_unavailable',json_object('rule',rule_id,'revision',revision,'from',next_start,'cutoff',?),? FROM alert_cursors WHERE project=? AND next_start<?`,cutoff,time,project,cutoff),s(db,`UPDATE alert_cursors SET next_start=(SELECT CAST((?+window_ms-1)/window_ms AS INTEGER)*window_ms FROM alert_rules WHERE id=rule_id) WHERE project=? AND next_start<?`,cutoff,project,cutoff)];
}
