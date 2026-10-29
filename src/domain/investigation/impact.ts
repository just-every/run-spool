import {affectedUsers} from '../identities/read';
import {releaseHealth} from '../sessions/health';
import {releaseOrderRanks} from '../releases/policy';

/** Retained issue figures never infer an event-to-session association from a
 * shared release or user. Release health is the project's separate cohort. */
export async function issueImpact(db:D1Database,project:string,issue:string){
 const to=Date.now()+1,from=to-86400000;
 const [totals,releases,users,health,ranks,retention]=await Promise.all([
  db.prepare("SELECT COUNT(*) events,MIN(received) firstSeen,MAX(received) lastSeen,SUM(CASE WHEN release='' THEN 1 ELSE 0 END) noReleaseEvents,SUM(CASE WHEN received>=? AND received<? THEN 1 ELSE 0 END) recentEvents FROM events WHERE project=? AND issue=?").bind(from,to,project,issue).first<any>(),
  db.prepare("SELECT release,COUNT(*) events,MIN(received) firstSeen,MAX(received) lastSeen FROM events WHERE project=? AND issue=? AND release<>'' GROUP BY release").bind(project,issue).all<any>(),
  affectedUsers(db,project,issue),releaseHealth(db,project,to-90*86400000,to,null),releaseOrderRanks(db,project),
  db.prepare("SELECT MAX(json_extract(detail,'$.cutoff')) appliedCutoff,COALESCE(SUM(json_extract(detail,'$.removed')),0) removedProjectEvents FROM audit WHERE project=? AND kind='retention_gap'").bind(project).first(),
 ]);
 return {version:1,retention,events:totals.events,firstSeen:totals.firstSeen,lastSeen:totals.lastSeen,users,
  rate:{from,to,events:totals.recentEvents??0,perHour:(totals.recentEvents??0)*3600000/(to-from)},
  affectedSessions:null,sessionCoverage:'Unavailable: retained SDK events do not establish an exact session association. Project release-health sessions below are not affected sessions for this issue.',
  releases:{noReleaseEvents:totals.noReleaseEvents??0,rows:releases.results.sort((a,b)=>ranks.get(a.release)!-ranks.get(b.release)!).map(row=>({...row,projectHealth:health.rows.filter(r=>r.release===row.release)}))},
  projectHealth:{window:health.window,denominators:health.denominators,method:health.method,coverage:health.coverage},
  coverage:'All retained occurrences, including events without a release, contribute to totals, affected users and the 24-hour receipt rate. Release history excludes and counts events without a release. First and last refer to retained receipts; expired evidence is not reconstructed.'};
}
