import { regressionSql } from '../releases/order';
import { originalMembership } from '../operators/provenance';
import { statement as s } from './types';
import { issueLink, publicOrigin } from './payload';
import { captureFact } from './capture-history';
// Lifetime facts survive retention. Without them, a legacy retention gap is
// unknown history, never proof that a later capture is the issue's first.
const firstUnsuppressedAlert = `NOT EXISTS(SELECT 1 FROM alerts previous WHERE previous.project=i.project AND previous.issue=i.id AND previous.kind='new_issue')
 AND NOT ${captureFact('capture_unsuppressed', 'i.id')}
 AND (${captureFact('capture_history_started', 'i.id')} OR NOT EXISTS(
  SELECT 1 FROM audit gap WHERE gap.project=i.project AND gap.kind='retention_gap'
   AND json_extract(gap.detail,'$.removed')>0 AND (gap.created>=i.first_seen OR EXISTS(
    SELECT 1 FROM grouping_corrections correction WHERE correction.project=i.project AND correction.state IN ('applied','undone')
     AND (json_extract(correction.plan,'$.target')=i.id OR EXISTS(
      SELECT 1 FROM json_each(correction.plan,'$.issues') member WHERE json_extract(member.value,'$.id')=i.id))))))
 AND NOT EXISTS(SELECT 1 FROM events e WHERE e.project=i.project AND e.historical=0
  AND (e.issue=i.id OR ${originalMembership('e','i.id')})
  AND NOT (e.id=? AND e.occurrence=?)
  AND NOT EXISTS(SELECT 1 FROM event_suppressions x WHERE x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence))`;
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
export function admissionAlerts(db:D1Database,input:{alertId:string;project:string;issue:string;eventId:string;occurrence:string;release:string;build:string;sequence:number;time:number;origin?:string}) {
 const {alertId:id,project,issue,eventId,occurrence,release,build,time}=input;
 return [s(db,`WITH candidate AS (
  SELECT i.project,i.id,i.title,i.state,i.latest_release_seq,i.resolved_seq,
   (SELECT release_seq FROM events incoming WHERE incoming.project=i.project AND incoming.id=? AND incoming.occurrence=?) current_sequence,
   EXISTS(SELECT 1 FROM events incoming WHERE incoming.project=i.project AND incoming.id=? AND incoming.occurrence=? AND ${regressionSql()}) regresses,
   (${firstUnsuppressedAlert}) AS first_capture,
   EXISTS(SELECT 1 FROM events captured WHERE captured.project=i.project AND captured.id=? AND captured.occurrence=?
    AND captured.issue=i.id AND captured.historical=0
    AND NOT EXISTS(SELECT 1 FROM event_suppressions receipt WHERE receipt.project=captured.project AND receipt.event=captured.id AND receipt.occurrence=captured.occurrence)) AS current_unsuppressed
  FROM issues i WHERE i.id=? AND i.project=? AND i.algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1')
 )
 INSERT INTO alerts(id,project,issue,kind,created,payload)
 SELECT ?,project,id,CASE WHEN first_capture THEN 'new_issue' ELSE 'regression' END,?,
  json_object('schema','spool.alert.v1','alertId',?,'kind',CASE WHEN first_capture THEN 'new_issue' ELSE 'regression' END,
   'projectId',project,'issueId',id,'occurredAt',?,'title',title,'release',json_object('name',?,'build',?,'sequence',current_sequence),'issueUrl',?)
 FROM candidate WHERE current_unsuppressed=1 AND state<>'suppressed'
  AND (first_capture=1 OR (state='resolved' AND regresses=1))`,
 eventId,occurrence,eventId,occurrence,eventId,occurrence,eventId,occurrence,issue,project,id,time,id,new Date(time).toISOString(),release,build,issueLink(publicOrigin(input.origin),project,issue)),...routeStatements(db,id,time)];
}
