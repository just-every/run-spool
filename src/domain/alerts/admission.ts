import { statement as s } from './types';
import { issueLink, publicOrigin } from './payload';
// SQL evaluates this inside event admission, so an in-flight HTTP request cannot
// commit an old received timestamp after a complete spike window was consumed.
export const receivedAtSql="CAST(strftime('%s','now') AS INTEGER)*1000+CAST(substr(strftime('%f','now'),4,3) AS INTEGER)";
// These statements join the real admission batch. No network or nested transaction is allowed here.
export function routeStatements(db:D1Database,alertId:string,time:number,onlyRule?:string) {
 return [s(db,`INSERT INTO alert_intents(id,project,alert_id,rule_id,rule_revision,channel,destination,body,event,created)
 SELECT a.id||'.'||r.id||'.'||r.revision,a.project,a.id,r.id,r.revision,r.channel,r.destination,a.payload,
 CASE a.kind WHEN 'new_issue' THEN 'spool.issue.new' WHEN 'regression' THEN 'spool.issue.regressed' ELSE 'spool.issue.spike' END,?
 FROM alerts a JOIN alert_rules r ON r.project=a.project
 WHERE a.id=? AND r.enabled=1 AND a.payload IS NOT NULL AND (a.kind<>'spike' OR json_extract(a.payload,'$.rule.revision')=r.revision) AND EXISTS(SELECT 1 FROM json_each(r.kinds) WHERE value=a.kind)
 ${onlyRule?'AND r.id=?':''} ON CONFLICT(id) DO NOTHING`,time,alertId,...(onlyRule?[onlyRule]:[])),
 s(db,`INSERT INTO alert_history(id,project,alert_id,rule_id,rule_revision,channel,destination,state,created,updated)
 SELECT id,project,alert_id,rule_id,rule_revision,channel,destination,'pending',created,? FROM alert_intents WHERE alert_id=? ON CONFLICT(id) DO NOTHING`,time,alertId)];
}
export function admissionAlerts(db:D1Database,input:{alertId:string;project:string;issue:string;release:string;build:string;sequence:number;time:number;origin?:string}) {
 const {alertId:id,project,issue,release,build,sequence,time}=input;
 return [s(db,`INSERT INTO alerts(id,project,issue,kind,created,payload)
 SELECT ?,project,id,CASE WHEN revision=0 THEN 'new_issue' ELSE 'regression' END,?,
 json_object('schema','spool.alert.v1','alertId',?,'kind',CASE WHEN revision=0 THEN 'new_issue' ELSE 'regression' END,
 'projectId',project,'issueId',id,'occurredAt',?,'title',title,'release',json_object('name',?,'build',?,'sequence',?),'issueUrl',?)
 FROM issues WHERE id=? AND project=? AND algorithm='js-frame-v1' AND (revision=0 OR (state='resolved' AND latest_release_seq IS NOT NULL AND ?>resolved_seq))`,
 id,time,id,new Date(time).toISOString(),release,build,sequence,issueLink(publicOrigin(input.origin),project,issue),issue,project,sequence),...routeStatements(db,id,time)];
}
