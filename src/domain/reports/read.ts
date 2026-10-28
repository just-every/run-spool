import {resolvedProjectTeams} from '../members/resolver';
import type {ReportRead,ReportInput} from './types';
import {eventUserKeySql} from '../identities/read';
import {AuthError} from '../../modules/operator-auth/index.mjs';

export const reportScopeLimit=150000;
export class ReportScopeError extends AuthError {
 readonly limit=reportScopeLimit;
 readonly action='Choose fewer projects or a narrower window.';
 constructor(readonly matched:number){super('report_scope_limit',413)}
}

async function reportScope(db:D1Database,ids:string,input:ReportInput){
 const scope='project IN (SELECT value FROM json_each(?))';
 const checks:[string,unknown[]][]=[
  [`events WHERE ${scope} AND received>=? AND received<?`,[ids,input.from,input.to]],
  [`issues WHERE ${scope} AND first_seen<?`,[ids,input.to]],
  [`audit WHERE ${scope} AND kind IN ('triage','commit_resolution','capture_history_started','retention_gap')`,[ids]],
  [`alerts WHERE ${scope} AND kind IN ('new_issue','regression')`,[ids]],
  [`review_stamps WHERE ${scope}`,[ids]],
  [`grouping_corrections WHERE ${scope} AND state<>'preview'`,[ids]],
  [`outcomes WHERE ${scope} AND window>=? AND window<?`,[ids,Math.floor(input.from/60000)*60000,input.to]],
  [`health_sessions WHERE ${scope} AND started>=? AND started<?`,[ids,input.from,input.to]],
  [`health_aggregates WHERE ${scope} AND started>=? AND started<?`,[ids,input.from,input.to]],
 ];
 const counts=await db.batch(checks.map(([query,args])=>db.prepare('SELECT COUNT(*) total FROM '+query).bind(...args)));
 const matched=counts.reduce((total,result)=>total+Number((result.results[0] as any).total),0);
 if(matched>reportScopeLimit)throw new ReportScopeError(matched);
}

export async function reportProjects(db:D1Database,authorized:string[],team?:string){
 if(!Array.isArray(authorized)||authorized.some(p=>typeof p!=='string'||!p))throw new Error('Authorized report projects required');
 return resolvedProjectTeams(db,authorized,team);
}
export async function readReport(db:D1Database,projects:string[],input:ReportInput):Promise<ReportRead>{
 const ids=JSON.stringify(projects),scope='project IN (SELECT value FROM json_each(?))';
 await reportScope(db,ids,input);
 // A single read batch gives the event, state and history computations the same
 // database snapshot. Projection never includes raw user fields or payloads.
 const rows=await db.batch([
  db.prepare(`SELECT e.project,e.issue,e.received,e.release,json_extract(e.payload,'$.dropped') dropped,
   ${eventUserKeySql()} user_key
   FROM events e LEFT JOIN event_identities x ON x.project=e.project AND x.event=e.id AND x.occurrence=e.occurrence
   WHERE e.${scope} AND e.received>=? AND e.received<? ORDER BY e.received,e.project,e.id`).bind(ids,input.from,input.to),
  db.prepare(`SELECT i.project,i.id,i.state,i.first_seen,i.last_seen,i.algorithm,a.label FROM issues i LEFT JOIN issue_assignments a ON a.project=i.project AND a.issue=i.id WHERE i.${scope} AND i.first_seen<? ORDER BY i.project,i.id`).bind(ids,input.to),
  db.prepare(`SELECT project,kind,detail,created FROM audit WHERE ${scope} AND kind IN ('triage','commit_resolution','capture_history_started','retention_gap') ORDER BY created,rowid`).bind(ids),
  db.prepare(`SELECT project,issue,id,kind,created FROM alerts WHERE ${scope} AND kind IN ('new_issue','regression') ORDER BY created,rowid`).bind(ids),
  db.prepare(`SELECT project,issue,alert,reviewed FROM review_stamps WHERE ${scope}`).bind(ids),
  db.prepare(`SELECT project,state,plan FROM grouping_corrections WHERE ${scope} AND state<>'preview'`).bind(ids),
  db.prepare(`SELECT project,reason,SUM(count) count FROM outcomes WHERE ${scope} AND window>=? AND window<? GROUP BY project,reason ORDER BY project,reason`).bind(ids,Math.floor(input.from/60000)*60000,input.to),
 ]);
 return {events:rows[0].results,issues:rows[1].results,history:rows[2].results,alerts:rows[3].results,reviews:rows[4].results,corrections:rows[5].results,outcomes:rows[6].results} as unknown as ReportRead;
}
