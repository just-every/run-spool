import type { Context } from 'hono';
import { releaseOrderKeyStatement, releaseOrderSql } from '../releases/order';
import { releaseIdentity, releaseVersionKey } from '../releases/identity';
import { absentDist } from '../releases/build';
import { scrub } from '../privacy';
import { commitsInput, type CommitInput } from '../commits/input';
import { commitStatements, citationSummary } from '../commits/register';
import { auditCommit } from '../audit/context';
import { readReleasePolicy } from '../releases/policy';
import { ensureShortIds } from '../short-ids/assign';
import { deployBatch } from '../sentry/deploy';
import type { CliAuthority } from './auth';
import { cliError, CliRefusal, refuse } from './errors';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);

export function releaseName(value: unknown): string {
 try { return releaseIdentity(value); } catch { return refuse(400, 'Invalid release version: use 1 to 200 letters, digits and . _ : @ + -'); }
}
/** Sentry sends fractional seconds beyond milliseconds; accept any ISO instant and keep milliseconds. */
export function instant(value: unknown, name: string): number | null {
 if (value === undefined || value === null) return null;
 const time = typeof value === 'string' ? Date.parse(value) : NaN;
 if (!Number.isSafeInteger(time) || time < 0) return refuse(400, `${name} must be an ISO 8601 timestamp`);
 return time;
}
/** A release or deploy link: absolute http(s), scrubbed like any captured text, never another scheme. */
export function httpUrl(value: unknown): string {
 try {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol) || String(value).length > 2048) throw new Error();
  return scrub(url.href);
 } catch { return refuse(400, 'url must be an absolute http or https URL of at most 2048 characters'); }
}
const iso = (time: number | null) => time === null ? null : new Date(time).toISOString();

/** The registration an unmodified `sentry-cli releases new` makes. An SDK-created (auto-created) release is
 * enriched, never split: it keeps its sequence, first-seen time and first environment, and loses its label. */
export function registrationStatements(db: D1Database, project: string, name: string, build: string, time: number) {
 return [
  s(db, 'INSERT INTO releases(project,name,seq,build,created) SELECT ?,?,(SELECT COALESCE(MAX(seq),0)+1 FROM releases WHERE project=?),?,? WHERE NOT EXISTS(SELECT 1 FROM releases WHERE project=? AND name=?)', project, name, project, build, time, project, name),
  s(db, "INSERT INTO audit SELECT ?,?,'release_registered',json_object('name',name,'build',build,'seq',seq),? FROM releases WHERE project=? AND name=? AND changes()=1", crypto.randomUUID(), project, time, project, name),
  s(db, "INSERT INTO release_metadata(project,release,first_seen,environment,sdk,auto_created,version_key) SELECT project,name,created,'unknown','{}',0,? FROM releases WHERE project=? AND name=? ON CONFLICT(project,release) DO UPDATE SET auto_created=0", releaseVersionKey(name), project, name),
  releaseOrderKeyStatement(db, project, name),
  s(db, 'INSERT INTO release_builds VALUES(?,?,?,1) ON CONFLICT(project,release,build) DO UPDATE SET registered=1', project, name, build),
 ];
}
export const registerBuildStatement = (db: D1Database, project: string, name: string, build: string) =>
 s(db, 'INSERT INTO release_builds VALUES(?,?,?,1) ON CONFLICT(project,release,build) DO UPDATE SET registered=1', project, name, build);

/** `commits` as sentry-cli --local (and Sentry's release API) sends them. */
export function sentryCommits(value: unknown): CommitInput[] {
 if (value === undefined || value === null) return [];
 if (!Array.isArray(value)) return refuse(400, 'commits must be a list');
 try {
  return commitsInput(value.map((commit: any) => {
   if (!commit || typeof commit !== 'object' || typeof commit.id !== 'string') throw new Error('Each commit has an id');
   const present = (text: unknown) => typeof text === 'string' && text.length ? text : undefined;
   const author = { name: present(commit.author_name)?.slice(0, 200), email: present(commit.author_email)?.slice(0, 320) };
   return { sha: commit.id, ...(Array.isArray(commit.patch_set) ? {files:commit.patch_set.map((file:any)=>file.path)} : {}), message: present(commit.message)?.slice(0, 8192), author: Object.fromEntries(Object.entries(author).filter(([, v]) => v !== undefined)) };
  }));
 } catch (error) { return refuse(400, (error as Error).message); }
}

export async function releaseView(db: D1Database, project: string, name: string) {
 const row = await s(db, `SELECT r.name,r.seq,r.created,m.first_seen,m.auto_created,x.url,x.started,x.released,
  (SELECT COUNT(*) FROM release_commits rc WHERE rc.project=r.project AND rc.release=r.name) commits,
  (SELECT COUNT(*) FROM sentry_deploys d WHERE d.project=r.project AND d.release=r.name) deploys
  FROM releases r LEFT JOIN release_metadata m ON m.project=r.project AND m.release=r.name LEFT JOIN sentry_releases x ON x.project=r.project AND x.release=r.name WHERE r.project=? AND r.name=?`, project, name).first<any>();
 if (!row) return null;
 const last = await s(db, 'SELECT id,environment,name,url,started,finished FROM sentry_deploys WHERE project=? AND release=? ORDER BY created DESC,id LIMIT 1', project, name).first<any>();
 return {
  id: String(row.seq), version: row.name, shortVersion: row.name, ref: null, url: row.url ?? null,
  dateCreated: iso(row.first_seen ?? row.created), dateReleased: iso(row.released), dateStarted: iso(row.started),
  newGroups: 0, commitCount: row.commits, deployCount: row.deploys, lastCommit: null, lastDeploy: last ? deployView(last) : null, authors: [],
  projects: [{ id: 1, slug: project, name: project, newGroups: 0 }], firstEvent: null, lastEvent: null, autoCreated: row.auto_created === 1,
 };
}
export async function listReleases(c: Context, who: CliAuthority): Promise<Response> {
 await readReleasePolicy(c.env.DB, who.project);
 const names = (await s(c.env.DB, `SELECT name FROM releases WHERE project=? ORDER BY ${releaseOrderSql()} LIMIT 100`, who.project).all<{ name: string }>()).results;
 const views = await Promise.all(names.map(row => releaseView(c.env.DB, who.project, row.name)));
 return c.json(views.filter(Boolean));
}
export const deployView = (row: any) => ({ id: row.id, environment: row.environment, name: row.name ?? null, url: row.url ?? null, dateStarted: iso(row.started), dateFinished: iso(row.finished) });

export const repositoryRefsRefusal = 'Repository refs (--auto, --commit) name a connected repository (SRC-002), and this installation has none, so Spool cannot read commits from one. Send the commits with their messages and authors instead: `set-commits --local`, or no flag, which falls back to the local git history.';

/** POST /releases/ (create) and PUT /releases/:version/ (finalize, URL, commits): one idempotent upsert. */
export async function upsertRelease(c: Context, who: CliAuthority, body: any, created: boolean): Promise<Response> {
 const db = c.env.DB as D1Database, { project, auth } = who;
 try {
  const name = releaseName(body.version), commits = sentryCommits(body.commits);
  if (body.refs !== undefined && body.refs !== null && (!Array.isArray(body.refs) || body.refs.length)) return cliError(c, 501, repositoryRefsRefusal);
  const started = instant(body.dateStarted, 'dateStarted'), released = instant(body.dateReleased, 'dateReleased');
  let url: string | null = null;
  if (body.url !== undefined && body.url !== null) {
   url = httpUrl(body.url);
  }
  const before = await s(db, 'SELECT 1 FROM releases WHERE project=? AND name=?', project, name).first();
  if (!before && !created) return cliError(c, 404, 'Release not found. Ensure that you configured the correct release, project, and organization.');
  if (commits.length) { await readReleasePolicy(db, project); await ensureShortIds(db, project); }
  const time = Date.now();
  await deployBatch(c, auth, [
   ...before ? [] : registrationStatements(db, project, name, absentDist, time),
   ...before ? [s(db, 'UPDATE release_metadata SET auto_created=0 WHERE project=? AND release=?', project, name)] : [],
   s(db, `INSERT INTO sentry_releases(project,release,url,started,released,created) VALUES(?,?,?,?,?,?)
    ON CONFLICT(project,release) DO UPDATE SET url=COALESCE(excluded.url,sentry_releases.url),started=COALESCE(sentry_releases.started,excluded.started),released=COALESCE(sentry_releases.released,excluded.released)`, project, name, url, started, released, time),
   auditCommit(db),
   ...commitStatements(db, project, name, 'release', commits, time),
  ]);
  const view = await releaseView(db, project, name);
  return c.json({ ...view, ...commits.length ? { citations: await citationSummary(db, project, commits) } : {} }, created ? (before ? 208 : 201) : 200);
 } catch (error) {
  if (error instanceof CliRefusal) return cliError(c, error.status, error.detail);
  throw error;
 }
}
