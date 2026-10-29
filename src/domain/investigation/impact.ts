import {affectedUsers} from '../identities/read';
import {releaseHealth} from '../sessions/health';
import {releaseOrderRanks} from '../releases/policy';

/** Retained issue figures never infer an event-to-session association from a
 * shared release or user. Release health is the project's separate cohort. */
export async function issueImpact(db:D1Database,project:string,issue:string){
 const to=Date.now()+1,from=to-86400000;
 const sessionJoin="LEFT JOIN health_sessions s ON s.project=e.project AND s.sid=json_extract(e.payload,'$.sdkSession') AND (e.release='' OR s.release=e.release) AND s.environment=e.environment";
 const [totals,releases,users,health,ranks,retention,sessions]=await Promise.all([
  db.prepare("SELECT COUNT(*) events,MIN(received) firstSeen,MAX(received) lastSeen,SUM(CASE WHEN release='' THEN 1 ELSE 0 END) noReleaseEvents,SUM(CASE WHEN received>=? AND received<? THEN 1 ELSE 0 END) recentEvents FROM events WHERE project=? AND issue=?").bind(from,to,project,issue).first<any>(),
  db.prepare(`SELECT e.release,COUNT(*) events,MIN(e.received) firstSeen,MAX(e.received) lastSeen,COUNT(DISTINCT s.sid) knownAffectedSessions,COUNT(*)-COUNT(s.sid) unlinkedSessionEvents FROM events e ${sessionJoin} WHERE e.project=? AND e.issue=? AND e.release<>'' GROUP BY e.release`).bind(project,issue).all<any>(),
  affectedUsers(db,project,issue),releaseHealth(db,project,to-90*86400000,to,null),releaseOrderRanks(db,project),
  db.prepare("SELECT MAX(json_extract(detail,'$.cutoff')) appliedCutoff,COALESCE(SUM(json_extract(detail,'$.removed')),0) removedProjectEvents FROM audit WHERE project=? AND kind='retention_gap'").bind(project).first(),
  db.prepare(`SELECT COUNT(*) events,COUNT(s.sid) linkedEvents,COUNT(*)-COUNT(s.sid) unlinkedEvents,COUNT(DISTINCT s.sid) knownAffected FROM events e ${sessionJoin} WHERE e.project=? AND e.issue=?`).bind(project,issue).first<any>(),
 ]);
 return {version:1,retention,events:totals.events,firstSeen:totals.firstSeen,lastSeen:totals.lastSeen,users,
  rate:{from,to,events:totals.recentEvents??0,perHour:(totals.recentEvents??0)*3600000/(to-from)},
  affectedSessions:sessions.unlinkedEvents?null:sessions.knownAffected,sessions,sessionCoverage:'Affected sessions count distinct SDK-sent contexts.session.sid values that match a retained individual session in this project and environment, with the same release when the event names one. No link is inferred from a shared user or release. An event without a verified link leaves the total unavailable; verified sessions are a lower bound. Project release-health sessions below are a separate cohort, not affected sessions for this issue.',
  releases:{noReleaseEvents:totals.noReleaseEvents??0,rows:releases.results.sort((a,b)=>ranks.get(a.release)!-ranks.get(b.release)!).map(row=>({...row,projectHealth:health.rows.filter(r=>r.release===row.release)}))},
  projectHealth:{window:health.window,denominators:health.denominators,method:health.method,coverage:health.coverage},
  coverage:'All retained occurrences, including events without a release, contribute to totals, affected users and the 24-hour receipt rate. Release history excludes and counts events without a release. First and last refer to retained receipts; expired evidence is not reconstructed.'};
}
