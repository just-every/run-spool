import { compareReleases } from '../releases/order';
import { readReleasePolicy } from '../releases/policy';
import { wilson } from '../sessions/health';
import { cohortSystems } from './metadata';
const system=(name:unknown)=>typeof name!=='string'?'unknown':/mac/i.test(name)?'macOS':/ios|iphone|ipad/i.test(name)?'iOS':cohortSystems.find(os=>os.toLowerCase()===name.toLowerCase())??'unknown';
const dimensions=(device:unknown,os:unknown)=>{
 const family=typeof device==='string'?device.toLowerCase():'';
 return {os:system(os),device:/ipad|tablet/.test(family)?'tablet':/iphone|mobile|phone/.test(family)?'mobile':/desktop|computer|mac|pc/.test(family)?'desktop':'unknown'};
};
export async function cohortComparison(db:D1Database,project:string,issue:string,from:number,to:number){
 const [sessions,aggregates,events,outcomes,retention,releases,{policy}]=await Promise.all([
  db.prepare(`SELECT s.release,s.environment,COALESCE(c.device,'unknown') device,COALESCE(c.os,'unknown') os,COUNT(*) sessions,
   SUM(s.status IN ('crashed','abnormal','unhandled')) unhealthy,SUM(s.status='ok') active
   FROM health_sessions s LEFT JOIN health_session_cohorts c ON c.project=s.project AND c.sid=s.sid WHERE s.project=? AND s.started>=? AND s.started<? GROUP BY s.release,s.environment,COALESCE(c.device,'unknown'),COALESCE(c.os,'unknown')`).bind(project,from,to).all<any>(),
  db.prepare('SELECT COALESCE(SUM(quantity),0) sessions FROM health_aggregates WHERE project=? AND started>=? AND started<?').bind(project,from,to).first<any>(),
  db.prepare(`SELECT release,environment,json_extract(payload,'$.sentry.contexts.device.family') device,json_extract(payload,'$.sentry.contexts.os.name') os,COUNT(*) occurrences,SUM(issue=?) issueEvents FROM events WHERE project=? AND received>=? AND received<? AND release<>'' GROUP BY release,environment,device,os`).bind(issue,project,from,to).all<any>(),
  db.prepare("SELECT reason,SUM(count) count FROM outcomes WHERE project=? AND window>=? AND window<? AND reason<>'accepted' AND reason<>'session_stored' GROUP BY reason ORDER BY reason").bind(project,Math.floor(from/60000)*60000,to).all<any>(),
  db.prepare("SELECT id,created,json_extract(detail,'$.removed') removed,json_extract(detail,'$.cutoff') cutoff FROM audit WHERE project=? AND kind='retention_gap' AND json_extract(detail,'$.cutoff')>? ORDER BY created,id").bind(project,from).all<any>(),
  db.prepare('SELECT r.name,r.seq,r.created,m.first_seen FROM releases r LEFT JOIN release_metadata m ON m.project=r.project AND m.release=r.name WHERE r.project=?').bind(project).all<any>(),
  readReleasePolicy(db,project),
 ]);
 const groups=new Map<string,any>(),key=(r:any)=>JSON.stringify([r.release,r.environment,r.device,r.os]);
 for(const row of sessions.results)groups.set(key(row),{...row,occurrences:0,issueEvents:0});
 for(const row of events.results){const value={...row,...dimensions(row.device,row.os)},id=key(value),prior=groups.get(id)??{release:row.release,environment:row.environment,...dimensions(row.device,row.os),sessions:0,unhealthy:0,active:0,occurrences:0,issueEvents:0};prior.occurrences+=row.occurrences;prior.issueEvents+=row.issueEvents;groups.set(id,prior)}
 const releaseMap=new Map(releases.results.map(row=>[row.name,row])),order=(a:any,b:any)=>compareReleases(releaseMap.get(a.release),releaseMap.get(b.release),policy.order);
 const cohortKey=(r:any)=>JSON.stringify([r.environment,r.device,r.os]),totals=new Map<string,number>();
 for(const row of groups.values())totals.set(cohortKey(row),(totals.get(cohortKey(row))??0)+row.sessions);
 const unattributed=new Map<string,number>();
 for(const row of groups.values())if(row.device==='unknown'||row.os==='unknown'){const id=JSON.stringify([row.release,row.environment]);unattributed.set(id,(unattributed.get(id)??0)+row.issueEvents)}
 const qualified=(row:any)=>row.sessions>0&&row.device!=='unknown'&&row.os!=='unknown'&&!(unattributed.get(JSON.stringify([row.release,row.environment]))??0);
 const rows=[...groups.values()].sort((a,b)=>cohortKey(a).localeCompare(cohortKey(b))||order(a,b)).map(row=>({...row,
  comparable:row.sessions>0&&row.device!=='unknown'&&row.os!=='unknown',
  rateQualified:qualified(row),unattributedIssueEvents:unattributed.get(JSON.stringify([row.release,row.environment]))??0,
  issueEventsPerSession:qualified(row)?row.issueEvents/row.sessions:null,
  unhealthySessionRate:row.sessions?row.unhealthy/row.sessions:null,
  interval:wilson(row.unhealthy,row.sessions),adoptionShare:totals.get(cohortKey(row))?row.sessions/totals.get(cohortKey(row))!:null,
 }));
 const contrasts:any[]=[],previous=new Map<string,any>();
 for(const row of rows){
  if(!row.comparable)continue;
  const earlier=previous.get(cohortKey(row));previous.set(cohortKey(row),row);
  if(row.rateQualified&&earlier?.rateQualified)contrasts.push({release:row.release,previousRelease:earlier.release,environment:row.environment,device:row.device,os:row.os,
   sessions:row.sessions,previousSessions:earlier.sessions,issueEvents:row.issueEvents,previousIssueEvents:earlier.issueEvents,
   issueRate:row.issueEventsPerSession,previousIssueRate:earlier.issueEventsPerSession,issueRateChange:row.issueEventsPerSession!-earlier.issueEventsPerSession!,
   unhealthySessionRate:row.unhealthySessionRate,previousUnhealthySessionRate:earlier.unhealthySessionRate,unhealthyRateChange:row.unhealthySessionRate!-earlier.unhealthySessionRate!,
   adoptionShare:row.adoptionShare,previousAdoptionShare:earlier.adoptionShare,
   attribution:'Observed correlation only; matched coarse cohorts do not demonstrate cause. Unreported loss and sampling remain unknown.'});
 }
 return {rows:rows.slice(0,200),contrasts:contrasts.slice(0,100),bounds:{availableRows:rows.length,rowLimit:200,availableContrasts:contrasts.length,contrastLimit:100},loss:{outcomes:outcomes.results,retention:retention.results,aggregateSessions:aggregates.sessions,unattributedIssueEvents:[...unattributed.values()].reduce((n,count)=>n+count,0),
  unknownCohortSessions:rows.filter(row=>!row.comparable).reduce((n,row)=>n+row.sessions,0),unreported:'unknown',
  attribution:'Project-wide receipt-minute losses cannot be assigned to a release or cohort; absence of a counter does not prove loss-free capture. Impact attribution is withheld.'},
  method:'Individual sessions grouped by the same environment, coarse device family and OS family over the same requested window. Device and OS come from protocol user agents; raw user agents are discarded. Unknown and aggregate cohorts are not comparable. An issue event with missing cohort dimensions withholds event-rate contrasts for that release and environment; it is never assigned to a known cohort. Adoption is observed session share within each cohort, not installed-device share. Event receipt times and session start times differ; events per session is a frequency, not a probability. Active sessions are incomplete; sampling, unseen clients and unreported loss are unknown. 95% Wilson intervals describe unhealthy-session proportions only.'};
}
