import { statement as s } from './types';
import { eligibleEvent, levelTagSql, userKey, type RuleConfig } from './filters';
import type { MetricConfig } from './metric-rules';

// Shared with immediate routing: enabling a waiting rule must not let another
// selected alert event bypass its missing user or session observations.
export function hasMatchingDataSql(config:string,project:string) {
 const match=(alias:string)=>`(json_extract(${config},'$.filters.environment') IS NULL OR ${alias}.environment=json_extract(${config},'$.filters.environment')) AND (json_extract(${config},'$.filters.release') IS NULL OR ${alias}.release=json_extract(${config},'$.filters.release'))`;
 return `CASE WHEN json_extract(${config},'$.metric')='users' THEN EXISTS(
  SELECT 1 FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence
  WHERE e.project=${project} AND ${eligibleEvent()} AND ${match('e')} AND ${levelTagSql(config)} AND ${userKey} IS NOT NULL)
 WHEN json_extract(${config},'$.metric')='session_percent' OR (json_extract(${config},'$.metric')='aggregate' AND json_extract(${config},'$.dataset')='sessions') THEN
  EXISTS(SELECT 1 FROM health_sessions h WHERE h.project=${project} AND ${match('h')}) OR
  EXISTS(SELECT 1 FROM health_aggregates h WHERE h.project=${project} AND ${match('h')} AND h.quantity>0)
 ELSE 1 END`;
}

// Read live, eligible observations rather than import history or another metric's data.
// This is a display state: missing observations never turn an owner's rule off.
export async function waitingForData(db:D1Database,project:string,config:RuleConfig|MetricConfig) {
 const kind=config.metric==='users'?'user_event':config.metric==='session_percent'||config.metric==='aggregate'&&config.dataset==='sessions'?'session':null;
 const found=kind?(await s(db,`SELECT ${hasMatchingDataSql('input.cfg','input.project')} found FROM (SELECT ? project,? cfg) input`,project,JSON.stringify(config)).first<{found:number}>())!.found:1;
 const waitingFor=found?null:kind;
 return {waitingFor,waitingReason:waitingFor==='user_event'?'Waiting for the first event with a user':waitingFor==='session'?'Waiting for the first session':null};
}
