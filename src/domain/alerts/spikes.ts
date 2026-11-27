import { importedAlertPrefix } from './import-state';
import type { AlertEnvironment, Rule } from './types';
import { statement as s } from './types';
import { routeStatements } from './admission';
import { issueLink, publicOrigin } from './payload';
import { hash } from '../privacy';
import { primaryShortIdSql } from '../short-ids/lookup';
import { configSql } from './preview';
import { eligibleEvent,eventFilter,ruleConfig,type RuleConfig } from './filters';
import { baselineDecisions,countDecision,decision,spikeWindowCounts } from './measure';
import { identityPolicyFence } from '../identities/policy';
type DueRule = Rule & {next_start:number; policy_revision:number};

async function windowDecisions(db:D1Database,rule:DueRule,config:RuleConfig,from:number,end:number){
 const {project,threshold}=rule;
 if(config.metric==='count'||config.metric==='users'){
  const metric=config.metric;
  return (await spikeWindowCounts(db,project,config,from,end)).map(row=>countDecision(metric,row.issue,from,end,threshold,row));
 }
 const f=eventFilter(config);
 // A session condition uses only the first candidate.
 const issues=(await s(db,`SELECT DISTINCT i.id FROM events e JOIN issues i ON i.id=e.issue AND i.project=e.project
  WHERE e.project=? AND ${eligibleEvent()} AND e.received>=? AND e.received<? AND ${f.sql} AND i.state<>'suppressed'
  ORDER BY i.id LIMIT ?`,project,from,end,...f.args,config.metric==='session_percent'?1:100).all<{id:string}>()).results;
 if(config.metric==='baseline')return baselineDecisions(db,project,config,issues.map(row=>row.id),from,end,threshold);
 return issues.length?[await decision(db,project,config,issues[0].id,from,end,threshold)]:[];
}

async function commitWindow(env:AlertEnvironment,rule:DueRule,config:RuleConfig,start:number,end:number,time:number){
 const db=env.DB,from=rule.revision===1&&rule.id.startsWith(importedAlertPrefix)?Math.max(start,rule.created):start;
 const decisions=await windowDecisions(db,rule,config,from,end);
 const rows=await Promise.all(decisions.map(async d=>{
  const id=await hash(JSON.stringify(['spike',rule.id,rule.revision,d.issue,start]));
  const payload=d.fired?{schema:'spool.alert.v1',alertId:id,kind:'spike',projectId:rule.project,issueId:d.issue,occurredAt:new Date(end).toISOString(),release:null,
   issueUrl:issueLink(publicOrigin(env.ALERT_PUBLIC_ORIGIN??env.AUTH_ORIGIN),rule.project,d.issue),
   window:{start:new Date(start).toISOString(),end:new Date(end).toISOString(),durationMs:rule.window_ms,count:d.count,threshold:rule.threshold,decision:{...d,start}},
   rule:{id:rule.id,revision:rule.revision}}:null;
  return {id,decision:{...d,start},payload};
 }));
 const jobs:D1PreparedStatement[]=[];
 let firstAlertWrite=0;
 if(rows.length){
  const f=eventFilter(config),encoded=JSON.stringify(rows);
  const authority=`EXISTS(SELECT 1 FROM alert_cursors c JOIN alert_rules r ON r.id=c.rule_id AND r.revision=c.revision
   WHERE c.rule_id=? AND c.revision=? AND c.next_start=? AND r.enabled=1)`;
  const cursor=[rule.id,rule.revision,start];
  jobs.push(identityPolicyFence(db,rule.project,rule.policy_revision));
  // Recheck all selected issues' retained evidence before any of the window's decisions can commit.
  jobs.push(s(db,`WITH expected AS MATERIALIZED (
    SELECT json_extract(value,'$.decision.issue') issue,json_extract(value,'$.decision.count') count FROM json_each(?)
   ), actual AS MATERIALIZED (
    SELECT e.issue,COUNT(*) count FROM events e WHERE e.project=? AND e.received>=? AND e.received<?
    AND ${eligibleEvent()} AND ${f.sql} AND e.issue IN (SELECT issue FROM expected) GROUP BY e.issue
   ) INSERT INTO spool_authority_guards(ok)
    SELECT NOT EXISTS(SELECT 1 FROM expected LEFT JOIN actual USING(issue) WHERE expected.count<>COALESCE(actual.count,0))`,encoded,rule.project,from,end,...f.args));
  jobs.push(s(db,`INSERT INTO alert_decisions
   SELECT json_extract(value,'$.id'),?,?,?,json_extract(value,'$.decision.issue'),?,?,json_extract(value,'$.decision.fired'),json_extract(value,'$.decision')
   FROM json_each(?) WHERE ${authority} ON CONFLICT(id) DO NOTHING`,rule.project,rule.id,rule.revision,start,end,encoded,...cursor));
  firstAlertWrite=jobs.length;
  const fired=rows.filter(row=>row.payload!==null);
  if(fired.length){
   jobs.push(s(db,`INSERT INTO alerts(id,project,issue,kind,created,payload)
    SELECT json_extract(value,'$.id'),i.project,i.id,'spike',?,json_set(json_extract(value,'$.payload'),'$.title',i.title,'$.shortId',${primaryShortIdSql('i')})
    FROM json_each(?) JOIN issues i ON i.id=json_extract(value,'$.decision.issue') AND i.project=?
    WHERE i.state<>'suppressed' AND ${authority} ON CONFLICT(id) DO NOTHING`,end,JSON.stringify(fired),rule.project,...cursor));
   for(const {id} of fired)jobs.push(...routeStatements(db,id,time,rule.id));
  }
 }
 const lastAlertWrite=jobs.length;
 jobs.push(s(db,`UPDATE alert_cursors SET next_start=? WHERE rule_id=? AND revision=? AND next_start=? AND EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND enabled=1 AND revision=?)`,end,rule.id,rule.revision,start,rule.id,rule.revision),
  s(db,'UPDATE alert_scheduler SET last_spike_rule=? WHERE id=1',rule.id));
 if(rows.length)jobs.push(s(db,'DELETE FROM spool_authority_guards'));
 const results=await db.batch(jobs);
 return results.slice(firstAlertWrite,lastAlertWrite).some(result=>result.meta.changes>0);
}

export async function evaluateSpikes(env:AlertEnvironment,time:number,lastRule:string) {
 const rules=(await s(env.DB,`SELECT r.*,${configSql} config,c.next_start,
  COALESCE((SELECT revision FROM identity_policies WHERE project=r.project),
   (SELECT MAX(json_extract(detail,'$.revision')) FROM audit WHERE project=r.project AND kind='identity_policy_changed'),0) policy_revision
  FROM alert_rules r JOIN alert_cursors c ON c.rule_id=r.id AND c.revision=r.revision WHERE r.enabled=1 AND c.next_start+r.window_ms<=? ORDER BY CASE WHEN r.id>? THEN 0 ELSE 1 END,r.id LIMIT 20`,time,lastRule).all<DueRule>()).results;
 let alertsChanged=false;
 for(const rule of rules){
  const config=ruleConfig(JSON.parse(rule.config));
  for(let turn=0,start=rule.next_start;turn<4&&start+rule.window_ms<=time;turn++,start+=rule.window_ms){
   if(await commitWindow(env,rule,config,start,start+rule.window_ms,time))alertsChanged=true;
  }
 }
 return alertsChanged;
}
export function retentionAlertStatements(db:D1Database,project:string,cutoff:number,time:number) {
 return [s(db,`INSERT INTO audit(id,project,kind,detail,created) SELECT lower(hex(randomblob(16))),project,'alert_history_unavailable',json_object('rule',rule_id,'revision',revision,'from',next_start,'cutoff',?),? FROM alert_cursors WHERE project=? AND next_start<?`,cutoff,time,project,cutoff),s(db,`UPDATE alert_cursors SET next_start=(SELECT CAST((?+window_ms-1)/window_ms AS INTEGER)*window_ms FROM alert_rules WHERE id=rule_id) WHERE project=? AND next_start<?`,cutoff,project,cutoff)];
}
