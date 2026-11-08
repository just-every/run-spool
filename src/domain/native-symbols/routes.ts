import { Hono } from 'hono';
import type { Bindings } from '../../auth/bindings';
import { authorizeDeploy, deployBatch } from '../sentry/deploy';
import { jsonBody } from '../owner-router';
import { releaseIdentity } from '../releases/identity';
import { storedBuild } from '../releases/build';
import { hash } from '../privacy';
import { nativeSymbolByteLimit, parseProguard } from './proguard';

const routes = new Hono<{ Bindings: Bindings }>();
routes.post('/:project/native-symbols', async c => {
 const project = c.req.param('project'), auth = await authorizeDeploy(c, project);
 if ('response' in auth) return auth.response;
 let input: any, release: string, build: string, payload: string;
 try {
  input = await jsonBody(c.req.raw, 2 * nativeSymbolByteLimit);
  if (Object.keys(input).sort().join() !== 'build,format,mapping,release' || input.format !== 'proguard' || typeof input.mapping !== 'string') throw new Error('Expected release, build, format proguard and mapping text');
  release = releaseIdentity(input.release); build = storedBuild(input.build); payload = input.mapping;
  parseProguard(payload);
 } catch (error) { return c.json({ error: (error as Error).message }, 400); }
 const db = c.env.DB, digest = await hash(payload);
 const select = () => db.prepare('SELECT digest FROM native_symbols WHERE project=? AND release=? AND build=? AND format=?').bind(project, release, build, 'proguard').first<{digest:string}>();
 const existing = await select();
 if (existing) {
  await deployBatch(c, auth, []);
  return existing.digest === digest ? c.json({ digest, format: 'proguard', bytes: new TextEncoder().encode(payload).length }, 200) : c.json({ error: 'Native symbol identity conflicts' }, 409);
 }
 const registered = await db.prepare('SELECT 1 FROM release_builds WHERE project=? AND release=? AND build=? AND registered=1').bind(project, release, build).first();
 if (!registered) return c.json({ error: 'Register this exact release and build before uploading native symbols' }, 409);
 try {
  await deployBatch(c, auth, [
   db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM projects WHERE id=?) AND EXISTS(SELECT 1 FROM release_builds WHERE project=? AND release=? AND build=? AND registered=1) AND NOT EXISTS(SELECT 1 FROM rer_erasure_operations WHERE phase<>?) THEN 1 ELSE 0 END').bind(project, project, release, build, 'complete'),
   db.prepare('INSERT INTO native_symbols(project,release,build,format,payload,digest,created) VALUES(?,?,?,?,?,?,?)').bind(project, release, build, 'proguard', payload, digest, Date.now()),
   db.prepare('INSERT INTO audit VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), project, 'native_symbols_uploaded', JSON.stringify({ release, build, format: 'proguard', digest }), Date.now()),
  ]);
  return c.json({ digest, format: 'proguard', bytes: new TextEncoder().encode(payload).length }, 201);
 } catch (error) {
  const current = await authorizeDeploy(c, project);
  if ('response' in current) return current.response;
  const row = await select();
  if (row) {
   await deployBatch(c, current, []);
   return row.digest === digest ? c.json({ digest, format: 'proguard', bytes: new TextEncoder().encode(payload).length }, 200) : c.json({ error: 'Native symbol identity conflicts' }, 409);
  }
  if (String(error).includes('artifact_storage_cap')) return c.json({ error: 'Native symbols exceed the project artifact storage cap' }, 429);
  throw error;
 }
});
export default routes;
