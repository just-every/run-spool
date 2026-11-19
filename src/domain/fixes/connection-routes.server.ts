import { Hono } from 'hono';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { jsonBody } from '../owner-router';
import { auditCommit } from '../audit/context';
import { ownerBatch, type OwnerSession } from '../owner-authority';
import { publicConnection } from './connection';
import { connection, prepareConnection } from './connection-store.server';
import { testConnection } from './connection-test.server';

const routes = new Hono<{Bindings:Bindings; Variables:{session:OwnerSession}}>();
routes.use('*', async (c,next) => {
 const env = runtimeBindings(c.env);
 const session = await ownerSession(c.req.raw,env);
 if (!session) return c.json({error:'Installation owner session required.'},401);
 c.set('session',session);
 c.header('Cache-Control','no-store');
 if (!['GET','HEAD'].includes(c.req.method)) {
  if (!ownerWrite(c.req.raw,env)) return c.json({error:'Same-origin required.'},403);
  if (env.RER_DEMO === '1') return c.json({error:'The demo uses a sample GitHub connection.'},403);
 }
 await next();
});

routes.get('/', async c => c.json(publicConnection(await connection(c.env))));
routes.put('/', async c => {
 const {value,save} = await prepareConnection(c.env,await jsonBody(c.req.raw,16_384));
 await ownerBatch(c.env.DB,c.get('session'),[save,auditCommit(c.env.DB)]);
 return c.json(publicConnection(value));
});
routes.delete('/', async c => {
 await ownerBatch(c.env.DB,c.get('session'),[c.env.DB.prepare('DELETE FROM spool_github_connection WHERE id=1'),auditCommit(c.env.DB,'changes()=1')]);
 return c.json(publicConnection(await connection(c.env)));
});
routes.post('/test', async c => {
 const link = await connection(c.env);
 if (link.state !== 'configured') return c.json({error:link.state === 'invalid' ? link.reason : 'Save a GitHub connection before testing.'},409);
 try { return c.json(await testConnection(link)); }
 catch (error) { return c.json({error:(error as Error).message},422); }
});

export default routes;
