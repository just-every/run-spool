import type { Context } from 'hono';
import { canonical, hash, scrub } from '../privacy';
import { auditCommit } from '../audit/context';
import { deployBatch } from '../sentry/deploy';
import type { CliAuthority } from './auth';
import { cliError, CliRefusal, refuse } from './errors';
import { deployView, httpUrl, instant, releaseName } from './release';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
const deployLimit = 1000;

function optionalText(value: unknown, name: string, limit: number): string | null {
 if (value === undefined || value === null || value === '') return null;
 if (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f]/.test(value) || scrub(value) !== value) return refuse(400, `${name} must be plain text of at most ${limit} characters`);
 return value;
}

/** POST /releases/:version/deploys/. A repeat of the same environment, name, URL and times is the same deploy. */
export async function createDeploy(c: Context, who: CliAuthority, version: string, body: any): Promise<Response> {
 const db = c.env.DB as D1Database, { project, auth } = who;
 try {
  const release = releaseName(version);
  if (typeof body?.environment !== 'string' || !/^[^\s/\\\u0000-\u001f\u007f][^/\\\u0000-\u001f\u007f]{0,63}$/.test(body.environment)) return cliError(c, 400, 'environment is required: at most 64 characters, no slash or control characters');
  const name = optionalText(body.name, 'name', 64), url = body.url === undefined || body.url === null || body.url === '' ? null : httpUrl(body.url), started = instant(body.dateStarted, 'dateStarted'), finished = instant(body.dateFinished, 'dateFinished');
  if (!await s(db, 'SELECT 1 FROM releases WHERE project=? AND name=?', project, release).first()) return cliError(c, 404, 'Release not found. Ensure that you configured the correct release, project, and organization.');
  const id = (await hash(canonical([release, body.environment, name, url, started, finished]))).slice(0, 16);
  const existing = await s(db, 'SELECT id,environment,name,url,started,finished FROM sentry_deploys WHERE project=? AND id=?', project, id).first<any>();
  if (existing) { await deployBatch(c, auth, []); return c.json(deployView(existing), 200); }
  const count = await s(db, 'SELECT COUNT(*) n FROM sentry_deploys WHERE project=? AND release=?', project, release).first<{ n: number }>();
  if ((count?.n ?? 0) >= deployLimit) return cliError(c, 429, `A release records at most ${deployLimit} deploys.`);
  const time = Date.now();
  await deployBatch(c, auth, [
   s(db, 'INSERT INTO deployment_actors VALUES(?,?,?) ON CONFLICT(project,authority) DO NOTHING', project, auth.actorKey, auth.actor),
   s(db, 'INSERT INTO sentry_deploys(project,id,release,environment,name,url,started,finished,actor,created) SELECT ?,?,?,?,?,?,?,?,label,? FROM deployment_actors WHERE project=? AND authority=? ON CONFLICT(project,id) DO NOTHING', project, id, release, body.environment, name, url, started, finished, time, project, auth.actorKey),
   auditCommit(db, 'changes()>0'),
   s(db, 'UPDATE release_metadata SET auto_created=0 WHERE project=? AND release=?', project, release),
  ]);
  return c.json(deployView({ id, environment: body.environment, name, url, started, finished }), 201);
 } catch (error) {
  if (error instanceof CliRefusal) return cliError(c, error.status, error.detail);
  throw error;
 }
}

export async function listDeploys(c: Context, who: CliAuthority, version: string): Promise<Response> {
 try {
  const release = releaseName(version);
  const rows = (await s(c.env.DB, 'SELECT id,environment,name,url,started,finished FROM sentry_deploys WHERE project=? AND release=? ORDER BY created DESC,id', who.project, release).all<any>()).results;
  return c.json(rows.map(deployView));
 } catch (error) {
  if (error instanceof CliRefusal) return cliError(c, error.status, error.detail);
  throw error;
 }
}
