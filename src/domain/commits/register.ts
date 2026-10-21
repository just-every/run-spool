import { auditCommit } from '../audit/context';
import { currentReleaseSequenceSql, releaseOrderSql } from '../releases/order';
import type { CommitInput } from './input';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
const uuidSql = "lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(2)))||'-'||lower(hex(randomblob(6)))";
const cited = "json_each(?) k JOIN commits c ON c.project=? AND c.sha=json_extract(k.value,'$.sha') AND c.message IS json_extract(k.value,'$.message'),json_each(k.value,'$.citations') x";
const named = "SELECT 1 FROM issue_short_ids t JOIN issues i ON i.id=t.issue AND i.project=t.project WHERE t.short_id=json_extract(x.value,'$.id')";

/** Commits a deploy-key registration includes in `release`, inside the door's own
 * audited batch. A citation links at once to a live issue of this project; any
 * other is logged with its reason and changes nothing. Repeats change nothing. */
export function commitStatements(db: D1Database, project: string, release: string, source: 'release' | 'deployment', commits: CommitInput[], time: number) {
 if (!commits.length) return [];
 const rows = JSON.stringify(commits), shas = JSON.stringify(commits.map(commit => commit.sha));
 return [
  // The first message wins; a bare earlier receipt takes a later message and author.
  s(db, `INSERT INTO commits(project,sha,message,author_name,author_email,received,expired) SELECT ?,json_extract(k.value,'$.sha'),json_extract(k.value,'$.message'),json_extract(k.value,'$.author_name'),json_extract(k.value,'$.author_email'),?,NULL FROM json_each(?) k WHERE true
   ON CONFLICT(project,sha) DO UPDATE SET message=excluded.message,author_name=excluded.author_name,author_email=excluded.author_email
   WHERE commits.message IS NULL AND commits.author_name IS NULL AND commits.author_email IS NULL AND commits.expired IS NULL AND COALESCE(excluded.message,excluded.author_name,excluded.author_email) IS NOT NULL`, project, time, rows),
  auditCommit(db, 'changes()>0'),
  s(db, `INSERT INTO commit_links(project,sha,issue,citation,short_id,linked) SELECT ?,c.sha,t.issue,json_extract(x.value,'$.citation'),t.short_id,? FROM ${cited}
   JOIN issue_short_ids t ON t.short_id=json_extract(x.value,'$.id') AND t.project=c.project JOIN issues i ON i.id=t.issue AND i.project=t.project
   WHERE i.algorithm<>'sentry-import-v1' ON CONFLICT(project,sha,issue) DO NOTHING`, project, time, rows, project),
  // Never a guess: an exact short ID of another project, of imported history, or of nothing.
  s(db, `INSERT INTO repository_link_log(project,sha,citation,reason,created) SELECT ?,c.sha,json_extract(x.value,'$.citation'),
   CASE WHEN EXISTS(${named} AND t.project=c.project) THEN 'inaccessible' WHEN EXISTS(${named}) THEN 'other_project' ELSE 'unknown' END,? FROM ${cited}
   WHERE NOT EXISTS(${named} AND t.project=c.project AND i.algorithm<>'sentry-import-v1') ON CONFLICT(project,sha,citation) DO NOTHING`, project, time, rows, project),
  s(db, 'INSERT INTO release_commits(project,release,sha,source,created) SELECT ?,?,value,?,? FROM json_each(?) WHERE true ON CONFLICT(project,release,sha) DO NOTHING', project, release, source, time, shas),
  // SDK-009 commit-SHA association: a release named by a commit's full SHA includes it.
  s(db, "INSERT INTO release_commits(project,release,sha,source,created) SELECT r.project,r.name,r.name,'sha_release',? FROM releases r WHERE r.project=? AND r.name IN (SELECT value FROM json_each(?)) ON CONFLICT(project,release,sha) DO NOTHING", time, project, shas),
  ...resolutionStatements(db, project, time),
 ];
}
/** What the registration's citations did, for CI output. Reasons stay in the owner's link
 * log: a project's deploy key learns nothing about other projects' issues. */
export async function citationSummary(db: D1Database, project: string, commits: CommitInput[]) {
 const shas = JSON.stringify(commits.map(commit => commit.sha));
 const [linked, logged] = await Promise.all([
  db.prepare('SELECT sha,short_id shortId,citation,release resolvedIn FROM commit_links WHERE project=? AND sha IN (SELECT value FROM json_each(?)) ORDER BY sha,short_id').bind(project, shas).all(),
  db.prepare('SELECT COUNT(*) count FROM repository_link_log WHERE project=? AND sha IN (SELECT value FROM json_each(?))').bind(project, shas).first<{ count: number }>(),
 ]);
 return { linked: linked.results, logged: logged?.count ?? 0, log: 'Unlinked citations and their reasons are in the project owner’s repository link log.' };
}
/** An auto-created release named by the full SHA of a commit this project holds includes it. */
export const shaReleaseStatement = (db: D1Database, project: string, release: string, time: number) =>
 s(db, "INSERT INTO release_commits(project,release,sha,source,created) SELECT project,sha,sha,'sha_release',? FROM commits WHERE project=? AND sha=? ON CONFLICT(project,release,sha) DO NOTHING", time, project, release);
/** A newly included citation resolves its issue in the first release, under the project's
 * SDK-009 order, that includes the commit: SDK-009's named resolution, so an occurrence in
 * that release or a later one regresses it and an older one cannot. Each change bumps the
 * issue revision, so a stale owner or bulk decision is refused. */
function resolutionStatements(db: D1Database, project: string, time: number) {
 const token = crypto.randomUUID(), inBatch = 'SELECT issue FROM commit_links WHERE project=? AND token=?';
 const first = `(SELECT r.name FROM release_commits rc JOIN releases r ON r.project=rc.project AND r.name=rc.release WHERE rc.project=commit_links.project AND rc.sha=commit_links.sha ORDER BY ${releaseOrderSql('r')} LIMIT 1)`;
 const resolving = (issue: string) => `FROM commit_links l JOIN releases r ON r.project=l.project AND r.name=l.release WHERE l.project=${issue}.project AND l.issue=${issue}.id AND l.token=? ORDER BY ${releaseOrderSql('r')},l.sha LIMIT 1`;
 return [
  s(db, `UPDATE commit_links SET release=${first},resolved=?,token=? WHERE project=? AND release IS NULL AND EXISTS(SELECT 1 FROM release_commits rc WHERE rc.project=commit_links.project AND rc.sha=commit_links.sha)`, time, token, project),
  // As the owner's named resolution: the issue keeps its numeric watermark; the boundary is the release.
  s(db, `UPDATE issues SET state='resolved',resolved_seq=COALESCE(latest_release_seq,(SELECT MAX(seq) FROM releases WHERE project=issues.project),0),latest_release_seq=COALESCE(latest_release_seq,(SELECT MAX(seq) FROM releases WHERE project=issues.project),0),revision=revision+1 WHERE project=? AND id IN (${inBatch})`, project, project, token),
  s(db, `INSERT INTO issue_resolutions(project,issue,mode,seen_without_release,updated,boundary_seq,observed_seq) SELECT i.project,i.id,'named',0,?,(SELECT r.seq ${resolving('i')}),${currentReleaseSequenceSql('i')} FROM issues i WHERE i.project=? AND i.id IN (${inBatch})
   ON CONFLICT(project,issue) DO UPDATE SET mode=excluded.mode,seen_without_release=0,updated=excluded.updated,boundary_seq=excluded.boundary_seq,observed_seq=excluded.observed_seq`, time, token, project, project, token),
  s(db, `INSERT INTO audit SELECT ${uuidSql},i.project,'commit_resolution',json_object('issue',i.id,'release',(SELECT r.name ${resolving('i')}),'commit',(SELECT l.sha ${resolving('i')}),'revision',i.revision),? FROM issues i WHERE i.project=? AND i.id IN (${inBatch})`, token, token, time, project, project, token),
  s(db, 'UPDATE commit_links SET token=NULL WHERE token=?', token),
 ];
}
