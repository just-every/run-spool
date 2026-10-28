import {eventQuery} from '../investigation/query';
import {pendingReview} from '../review/model';
import {eventUserKeySql} from '../identities/read';
import {scrub} from '../privacy';
import {metricConfig,type MetricConfig} from './input';
import {widgetCoverage} from './coverage';
import {ensureReleaseOrderKeys} from '../releases/order';

export const metricGroupLimit=100;
export async function widgetMetric(db:D1Database,project:string,input:MetricConfig){
 const config=metricConfig(input),query=eventQuery(config.q),sessions=config.metric==='sessions',users=config.metric==='users';
 if(query.usesLatest)await ensureReleaseOrderKeys(db,project);
 const predicate=sessions?query.sql.replaceAll('e.received','e.started'):query.sql;
 const from=sessions?'(SELECT project,release,environment,started,1 quantity FROM health_sessions UNION ALL SELECT project,release,environment,started,quantity FROM health_aggregates) e':
  'events e JOIN issues i ON i.project=e.project AND i.id=e.issue LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence';
 const where=`e.project=? AND e.${sessions?'started':'received'}>=? AND e.${sessions?'started':'received'}<? AND (${predicate})${!sessions&&query.reviewPending?` AND ${pendingReview('i')}`:''}`;
 const args:any[]=[project,config.from,config.to,...query.args],count=sessions?'COALESCE(SUM(e.quantity),0)':'COUNT(*)',userKey=eventUserKeySql();
 const columns=`${count} count,${sessions?'0':'COALESCE(SUM(CASE WHEN e.release=\'\' THEN 1 ELSE 0 END),0)'} no_release,${sessions?'0':"COALESCE(SUM(COALESCE(json_extract(e.payload,'$.dropped'),0)),0)"} native_dropped${users?`,COUNT(DISTINCT ${userKey}) users,COALESCE(SUM(CASE WHEN ${userKey} IS NULL THEN 1 ELSE 0 END),0) unattributed`:''}`;
 const tag=config.groupBy?.startsWith('tag:')?config.groupBy.slice(4):null;
 const group=tag?`(SELECT CAST(t.value AS TEXT) FROM json_each(e.payload,'$.sentry.tags') t WHERE t.key=? LIMIT 1)`:
  config.groupBy==='environment'?'e.environment':config.groupBy==='release'?'e.release':config.groupBy==='level'?"json_extract(e.payload,'$.sentry.level')":null;
 const statements=[db.prepare(`SELECT ${columns} FROM ${from} WHERE ${where}`).bind(...args)];
 if(group)statements.push(db.prepare(`SELECT ${group} grouping,${columns} FROM ${from} WHERE ${where}${config.groupBy==='release'?" AND e.release<>''":''} GROUP BY grouping ORDER BY count DESC,grouping LIMIT ?`).bind(...tag?[tag]:[],...args,metricGroupLimit+1));
 // Totals and grouped values refer to the same retained snapshot.
 const [results,metadata]=await Promise.all([db.batch(statements),widgetCoverage(db,project,config)]),total:any=results[0].results[0];
 const value=(row:any)=>config.metric==='rate'?row.count/((config.to-config.from)/60000):users?row.users||null:row.count;
 return {metric:config.metric,value:value(total),matchedEvents:sessions?null:total.count,noReleaseEvents:sessions?null:total.no_release,metadata:{...metadata,dropped:{...metadata.dropped,nativeClientDropped:total.native_dropped}},...users?{unattributed:total.unattributed}:{},
  groups:group?results[1].results.slice(0,metricGroupLimit).map((row:any)=>({group:row.grouping===null?null:scrub(String(row.grouping)),value:value(row),count:row.count,...users?{unattributed:row.unattributed}:{}})):[],
  bounds:{from:config.from,to:config.to,groupLimit:metricGroupLimit,complete:!group||results[1].results.length<=metricGroupLimit},
  definition:sessions?'Observed individual SDK sessions plus aggregate session quantities, grouped by session start. SID updates deduplicate; repeated aggregate envelopes cannot be deduplicated. Session observations cannot be associated with arbitrary event predicates.':users?
   'Distinct retained SDK008 user keys in this project among the matching occurrences. Native Spool events use their bounded random client identifier. No identity values are exposed; null means no known retained users, and unattributed counts matching occurrences without a retained key.':
   config.metric==='rate'?'Retained matching occurrences per minute of the explicit requested window; every event predicate matches the same occurrence. This is an observed rate, with no estimate of unobserved events.':
   'Retained matching occurrences; every event predicate matches the same occurrence. Group totals omit no retained matching event except groups beyond the explicit display cap.',
 };
}
