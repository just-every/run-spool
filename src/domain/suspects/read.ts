import {releaseHealth} from '../sessions/health';
import { scrub } from '../privacy';
import { releaseOrderSql } from '../releases/order';
// Shared evidence selection keeps owner reads and packets on the same retained basis.
export async function suspectCandidates(db: D1Database, project: string, issue: string) {
 const first = await db.prepare('SELECT id,occurrence,release,environment,received FROM events WHERE project=? AND issue=? ORDER BY received,id LIMIT 1').bind(project,issue).first<any>();
 const regressions = (await db.prepare("SELECT id,created,json_extract(payload,'$.release.name') release,COUNT(*) OVER () available FROM alerts WHERE project=? AND issue=? AND kind='regression' ORDER BY created DESC,id DESC LIMIT 20").bind(project,issue).all<any>()).results;
 const reasons = new Map<string, any[]>();
 if (first?.release) reasons.set(first.release,[{ kind: 'first_retained_occurrence', record: first }]);
 for (const row of regressions) if (row.release) reasons.set(row.release,[...reasons.get(row.release) ?? [],{ kind: 'reactivation', record: { alertId: row.id, received: row.created, release: row.release } }]);
 const candidates: any[] = [];
 let available = 0;
 for (const [release, basis] of reasons) {
  const [commits, deployments, decisions] = await Promise.all([
   db.prepare('SELECT rc.sha,rc.source,rc.created,COUNT(*) OVER () available FROM release_commits rc WHERE rc.project=? AND rc.release=? ORDER BY rc.created,rc.sha LIMIT 501').bind(project,release).all<any>(),
   db.prepare('SELECT id,environment,started_at started,deadline,historical,COUNT(*) OVER () available FROM deployment_runs WHERE project=? AND release=? ORDER BY started_at DESC,id LIMIT 20').bind(project,release).all(),
   db.prepare('SELECT sha,judgment,note,revision,updated FROM suspect_decisions WHERE project=? AND issue=? AND release=?').bind(project,issue,release).all<any>(),
  ]);
  const included = commits.results.length ? commits.results : [{sha:'',source:'retained_occurrence',created:first?.received??basis[0].record.received}];
  available += commits.results[0]?.available ?? 1;
  for (const commit of included) if (candidates.length < 100) {
   const decision = decisions.results.find(row => row.sha === commit.sha);
   candidates.push({ release, sha: commit.sha || null, reason: basis, inclusion: {sha:commit.sha,source:commit.source,created:commit.created}, deployments: deployments.results.map(({available,...row}:any)=>row),
    bounds: {deploymentsAvailable:deployments.results[0]?.available??0},
    correlation: 'Correlation, not a demonstrated cause.', changedSource: { available: false, reason: 'Recorded commit receipts contain no changed-file list. Source matching is unavailable; no path or ancestry is inferred.' },
    decision: decision ? { ...decision, note: scrub(decision.note), provenance: 'Engineer judgment; does not alter occurrences or establish cause.' } : null });
  }
 }
 return {candidates,bounds:{candidateLimit:100,available,reactivationsIncluded:regressions.length,reactivationsAvailable:regressions[0]?.available??0,reactivationLimit:20}};
}
export async function suspectView(db: D1Database, project: string, issue: string, from: number, to: number) {
 const selected=await suspectCandidates(db,project,issue);
 const health=await releaseHealth(db,project,from,to,null);
 const [comparison, releaseLess] = await Promise.all([
  db.prepare(`SELECT e.release,COUNT(*) occurrences,COUNT(DISTINCT e.issue) issues FROM events e JOIN releases r ON r.project=e.project AND r.name=e.release WHERE e.project=? AND e.release<>'' AND e.received>=? AND e.received<? GROUP BY e.release ORDER BY ${releaseOrderSql('r')}`).bind(project,from,to).all(),
  db.prepare("SELECT COUNT(*) count FROM events WHERE project=? AND release='' AND received>=? AND received<?").bind(project,from,to).first<{count:number}>(),
 ]);
 return { version:1, ...selected, comparison:{from,to,rows:comparison.results,releaseLess:releaseLess?.count??0,health,coverage:'Occurrence counts use receipt time; observed SDK-005 session rates use SDK session start time over the same window. Older releases remain listed. Device adoption, comparable cohorts and causal attribution remain unavailable.'},
  provenance:'Owner-recorded correlations and engineer judgments only. No automatic agent action or occurrence changes.' };
}
