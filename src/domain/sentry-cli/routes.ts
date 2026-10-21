import { Hono, type Context } from 'hono';
import type { Bindings } from '../../auth/bindings';
import { jsonBody } from '../owner-router';
import { cliAuthority, type CliAuthority } from './auth';
import { cliError } from './errors';
import { accepted, chunkSize, chunksPerRequest, concurrency, maxFileSize, maxRequestSize } from './limits';
import { receiveChunks } from './chunks';
import { assembleArtifactBundle } from './assemble';
import { assembleDebugFiles } from './debug-files';
import { listReleases, releaseView, upsertRelease, releaseName } from './release';
import { createDeploy, listDeploys } from './deploys';
import { CliRefusal } from './errors';

/** The Sentry API surface unmodified sentry-cli and Sentry build plugins call (SRC-003), under /api/0.
 * Every handler authorizes itself with a project deploy key. The organization slug carries no authority;
 * a project slug must be the key's own project. */
const routes = new Hono<{ Bindings: Bindings }>();
const slug = /^[A-Za-z0-9_.-]{1,100}$/;
type Handler = (c: Context, who: CliAuthority, body: any) => Promise<Response>;

function guarded(options: { body?: number; project?: boolean }, handler: Handler) {
 return async (c: Context) => {
  if (!slug.test(c.req.param('org') ?? '') || options.project && !slug.test(c.req.param('project') ?? '')) return cliError(c, 400, 'Invalid organization or project slug.');
  // The key is proven before the body is read or any slug is compared with it.
  const probe = await cliAuthority(c);
  if ('response' in probe) return probe.response;
  let body: any = {};
  if (options.body) {
   try { body = await jsonBody(c.req.raw, options.body); } catch (error) { return cliError(c, 400, String((error as Error).message || 'Expected a JSON body.')); }
  }
  const named = [...Array.isArray(body?.projects) ? body.projects : [], ...options.project ? [c.req.param('project')] : []];
  const who = await cliAuthority(c, named);
  if ('response' in who) return who.response;
  try { return await handler(c, who, body); } catch (error) {
   if (error instanceof CliRefusal) return cliError(c, error.status, error.detail);
   throw error;
  }
 };
}

routes.get('/organizations/:org/chunk-upload/', guarded({}, async c => c.json({
 // Absolute and on the host the client asked, as Sentry answers: newer clients refuse a URL whose host they cannot resolve.
 url: `${new URL(c.req.url).origin}/api/0/organizations/${c.req.param('org')}/chunk-upload/`,
 chunkSize, chunksPerRequest, maxFileSize, maxRequestSize, concurrency, hashAlgorithm: 'sha1', compression: ['gzip'], accept: accepted,
})));
routes.post('/organizations/:org/chunk-upload/', guarded({}, (c, who) => receiveChunks(c, who)));
routes.post('/organizations/:org/artifactbundle/assemble/', guarded({ body: 262144 }, assembleArtifactBundle));
routes.post('/projects/:org/:project/files/difs/assemble/', guarded({ body: 262144, project: true }, assembleDebugFiles));

routes.post('/organizations/:org/releases/', guarded({ body: 1048576 }, (c, who, body) => upsertRelease(c, who, body, true)));
routes.post('/projects/:org/:project/releases/', guarded({ body: 1048576, project: true }, (c, who, body) => upsertRelease(c, who, body, true)));
routes.get('/organizations/:org/releases/', guarded({}, (c, who) => listReleases(c, who)));
routes.get('/projects/:org/:project/releases/', guarded({ project: true }, (c, who) => listReleases(c, who)));
routes.get('/organizations/:org/releases/:version/', guarded({}, async (c, who) => {
 const view = await releaseView(c.env.DB, who.project, releaseName(c.req.param('version')));
 return view ? c.json(view) : cliError(c, 404, 'Release not found. Ensure that you configured the correct release, project, and organization.');
}));
routes.put('/organizations/:org/releases/:version/', guarded({ body: 1048576 }, (c, who, body) => upsertRelease(c, who, { ...body, version: c.req.param('version') }, false)));
routes.get('/organizations/:org/releases/:version/deploys/', guarded({}, (c, who) => listDeploys(c, who, c.req.param('version')!)));
routes.post('/organizations/:org/releases/:version/deploys/', guarded({ body: 65536 }, (c, who, body) => createDeploy(c, who, c.req.param('version')!, body)));
// No repository is connected (SRC-002), so the list is empty and sentry-cli reads commits from its own git
// history and sends them with their messages and authors; raw `refs` naming a repository are refused.
routes.get('/organizations/:org/repos/', guarded({}, async c => c.json([])));
routes.get('/organizations/:org/releases/:version/previous-with-commits/', guarded({}, async c => cliError(c, 404, 'Spool does not track a previous release\'s last commit; the client sends its recent commits and Spool keeps each once.')));

// Anything else a client sends is named, never answered with an empty success.
routes.all('/*', async c => {
 const probe = await cliAuthority(c);
 if ('response' in probe) return probe.response;
 return cliError(c, 501, `Spool does not serve ${c.req.method} ${new URL(c.req.url).pathname} for Sentry clients (SRC-003). Supported: chunk upload and options, artifact bundle assemble, release create/finalize/get, release commits (--local), deploys, and debug-file assemble (refused until SDK-002).`);
});
export default routes;
