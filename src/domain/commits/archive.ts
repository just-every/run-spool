import { scrubText } from '../scrub';
import { isShortId } from '../short-ids/format';
export const commitTables: Record<string, string[]> = {
 commits: ['project', 'sha', 'message', 'author_name', 'author_email', 'received', 'expired'],
 release_commits: ['project', 'release', 'sha', 'source', 'created'],
 commit_links: ['project', 'sha', 'issue', 'citation', 'short_id', 'linked', 'release', 'resolved', 'pr', 'token'],
 repository_link_log: ['project', 'sha', 'citation', 'reason', 'created'],
 commit_sharing: ['project', 'share', 'revision', 'updated'],
};
export const commitDefaults = (data: any) => ({ ...Object.fromEntries(Object.keys(commitTables).map(name => [name, []])), ...data });
export const commitAuditKinds: Record<string, string[]> = { commit_resolution: ['issue', 'release', 'commit', 'revision'], commit_sharing_changed: ['revision', 'share'] };
function assert(ok: unknown): asserts ok { if (!ok) throw new Error('Archive commit citation'); }
const integer = (value: any, min = 0) => Number.isSafeInteger(value) && value >= min;
const sha = (value: any) => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const personal = (value: any, limit: number) => value === null || typeof value === 'string' && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
const citation = /^(?:fixes|resolves|closes):?[ \t]+\S+$/i;
/** Author and message travel in the private archive and restore inert: no resolution
 * re-runs and nothing is sent; links keep the release they resolved in. */
export function validateCommitArchive(data: any) {
 const projects = new Set(data.projects.map((p: any) => p.id)), issues = new Map<string, any>(data.issues.map((i: any) => [i.id, i])), releases = new Set(data.releases.map((r: any) => r.project + '\n' + r.name));
 const commits = new Set<string>(), included = new Set<string>(), seen = new Set<string>();
 const once = (table: string, key: unknown[]) => { const value = JSON.stringify([table, ...key]); assert(!seen.has(value)); seen.add(value); };
 for (const row of data.commits) {
  assert(projects.has(row.project) && sha(row.sha) && integer(row.received) && (row.expired === null || integer(row.expired)) && personal(row.author_name, 200) && personal(row.author_email, 320));
  assert(row.message === null || typeof row.message === 'string' && row.message.length <= 8192 && scrubText(row.message, 8192) === row.message);
  assert(row.expired === null || row.message === null && row.author_name === null && row.author_email === null);
  once('commits', [row.project, row.sha]); commits.add(row.project + '\n' + row.sha);
 }
 for (const row of data.release_commits) {
  assert(commits.has(row.project + '\n' + row.sha) && releases.has(row.project + '\n' + row.release) && ['release', 'deployment', 'sha_release'].includes(row.source) && (row.source !== 'sha_release' || row.release === row.sha) && integer(row.created));
  once('release_commits', [row.project, row.release, row.sha]); included.add(JSON.stringify([row.project, row.release, row.sha]));
 }
 for (const row of data.commit_links) {
  assert(commits.has(row.project + '\n' + row.sha) && issues.get(row.issue)?.project === row.project && issues.get(row.issue).algorithm !== 'sentry-import-v1' && isShortId(row.short_id) && row.short_id === row.short_id.toUpperCase() && data.issue_short_ids.some((s: any) => s.short_id === row.short_id && s.project === row.project));
  assert(typeof row.citation === 'string' && row.citation.length <= 200 && citation.test(row.citation) && integer(row.linked) && row.pr === null && row.token === null);
  assert(row.release === null ? row.resolved === null : included.has(JSON.stringify([row.project, row.release, row.sha])) && integer(row.resolved));
  once('commit_links', [row.project, row.sha, row.issue]);
 }
 for (const row of data.repository_link_log) {
  assert(commits.has(row.project + '\n' + row.sha) && typeof row.citation === 'string' && row.citation.length <= 200 && citation.test(row.citation) && ['unknown', 'other_project', 'inaccessible'].includes(row.reason) && integer(row.created));
  once('repository_link_log', [row.project, row.sha, row.citation]);
 }
 for (const row of data.commit_sharing) { assert(projects.has(row.project) && [0, 1].includes(row.share) && integer(row.revision, 1) && integer(row.updated)); once('commit_sharing', [row.project]); }
}
