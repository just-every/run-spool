import { scrub } from '../privacy';
export async function suspectView(db: D1Database, project: string, issue: string, from: number, to: number) {
 const first = await db.prepare('SELECT id,occurrence,release,environment,received FROM events WHERE project=? AND issue=? ORDER BY received,id LIMIT 1').bind(project,issue).first<any>();
 const regressions = (await db.prepare("SELECT id,created,json_extract(payload,'$.release.name') release FROM alerts WHERE project=? AND issue=? AND kind='regression' ORDER BY created DESC,id DESC LIMIT 20").bind(project,issue).all<any>()).results;
 const reasons = new Map<string, any[]>();
 if (first?.release) reasons.set(first.release,[{ kind: 'first_retained_occurrence', record: first }]);
 for (const row of regressions) if (row.release) reasons.set(row.release,[...reasons.get(row.release) ?? [],{ kind: 'reactivation', record: { alertId: row.id, received: row.created, release: row.release } }]);
 const candidates: any[] = [];
 let available = 0;
 for (const [release, basis] of reasons) {
  const [commits, deployments, decisions] = await Promise.all([
   db.prepare('SELECT rc.sha,rc.source,rc.created FROM release_commits rc WHERE rc.project=? AND rc.release=? ORDER BY rc.created,rc.sha LIMIT 501').bind(project,release).all<any>(),
   db.prepare('SELECT id,environment,started_at started,deadline,historical FROM deployment_runs WHERE project=? AND release=? ORDER BY started_at DESC,id LIMIT 20').bind(project,release).all(),
   db.prepare('SELECT sha,judgment,note,revision,updated FROM suspect_decisions WHERE project=? AND issue=? AND release=?').bind(project,issue,release).all<any>(),
  ]);
  const included = commits.results.length ? commits.results : [{sha:'',source:'retained_occurrence',created:first?.received??basis[0].record.received}];
  available += included.length;
  for (const commit of included) if (candidates.length < 100) {
   const decision = decisions.results.find(row => row.sha === commit.sha);
   candidates.push({ release, sha: commit.sha || null, reason: basis, inclusion: commit, deployments: deployments.results,
    correlation: 'Correlation, not a demonstrated cause.', changedSource: { available: false, reason: 'Recorded commit receipts contain no changed-file list. Source matching is unavailable; no path or ancestry is inferred.' },
    decision: decision ? { ...decision, note: scrub(decision.note), provenance: 'Engineer judgment; does not alter occurrences or establish cause.' } : null });
  }
 }
 const [comparison, releaseLess] = await Promise.all([
  db.prepare("SELECT e.release,COUNT(*) occurrences,COUNT(DISTINCT e.issue) issues FROM events e WHERE e.project=? AND e.release<>'' AND e.received>=? AND e.received<? GROUP BY e.release ORDER BY MIN(e.release_seq) DESC,e.release").bind(project,from,to).all(),
  db.prepare("SELECT COUNT(*) count FROM events WHERE project=? AND release='' AND received>=? AND received<?").bind(project,from,to).first<{count:number}>(),
 ]);
 return { version:1, candidates, bounds:{candidateLimit:100,available,reactivationsIncluded:regressions.length,reactivationLimit:20}, comparison:{from,to,rows:comparison.results,releaseLess:releaseLess?.count??0,coverage:'Sessions unavailable (SDK-005): rates cannot be compared. Counts include older releases over the same receipt window; adoption and comparable cohorts are unavailable.'},
  provenance:'Owner-recorded correlations and engineer judgments only. No automatic agent action or occurrence changes.' };
}
