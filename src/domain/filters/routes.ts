import { categoryFilterCoverage } from './categories';
import {hash,canonical} from '../privacy.ts';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { ownerProjectRouter, ownerWrites, jsonBody } from '../owner-router.ts';
import { browserNames, defaultOnFilters, filterIds, filterLabels } from './types.ts';
import { defaultInboundPolicy, readInboundPolicy, validateInboundPolicy } from './policy.ts';
import { previewInbound, recentInboundCounts } from './reporting.ts';
import { crawlerCatalogue, crawlerCatalogueUpdated } from './crawlers.ts';

// This router authenticates its own direct transport using ownerSession;
// ownerProjectRouter also requires same-origin writes and an existing project.
export const inboundFilterRoutes = ownerProjectRouter();
inboundFilterRoutes.onError((error, c) => {
 if (error instanceof AuthError) return c.json({ error: error.code }, error.status as any);
 throw error;
});
inboundFilterRoutes.get('/', async c => {
 const project = c.req.param('project')!, since = Date.now() - 86400000;
 const [snapshot, counts] = await Promise.all([readInboundPolicy(c.env.DB, project), recentInboundCounts(c.env.DB, project, since)]);
 return c.json({ ...snapshot, defaults: defaultInboundPolicy(), defaultOnFilters,
  filters: filterIds.map(id => ({ id, label: filterLabels[id], recentMatches: counts[id] })),
  categoryFilterCoverage, recentSince: since, browsers: browserNames, crawlerCatalogue, crawlerCatalogueUpdated,
  patternSyntax: 'Only * is a wildcard. Message patterns ignore case; releases and environments preserve case. Browser maximum versions include the specified version family. Wildcard domains match subdomains, not the apex. Legacy exact origins remain allowed.',
 });
});
inboundFilterRoutes.put('/', async c => {
 let input: any, policy;
 try {
  input = await jsonBody(c.req.raw, 65536);
  if (Object.keys(input).sort().join() !== 'policy,revision' || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER) throw new Error('Expected current revision and policy');
  policy = validateInboundPolicy(input.policy);
 } catch (error) { return c.json({ error: (error as Error).message }, 400); }
 const project = c.req.param('project')!, revision = input.revision + 1, time = Date.now(), payload = JSON.stringify(policy);
 const result = await ownerWrites(c, [
  c.env.DB.prepare(`INSERT INTO inbound_filter_policies(project,revision,policy,updated)
   SELECT ?,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM inbound_filter_policies WHERE project=? AND revision=?)
   ON CONFLICT(project) DO UPDATE SET revision=excluded.revision,policy=excluded.policy,updated=excluded.updated
   WHERE inbound_filter_policies.revision=? RETURNING revision`).bind(project, revision, payload, time, input.revision, project, input.revision, input.revision),
  c.env.DB.prepare("INSERT INTO audit SELECT ?,?,'inbound_filters_changed',?,? WHERE changes()=1").bind(crypto.randomUUID(), project, JSON.stringify({ previousRevision: input.revision, revision, policyDigest:await hash(canonical(policy)) }), time),
 ]);
 if (!result[0].results.length) return c.json({ error: 'inbound_policy_revision_conflict', ...await readInboundPolicy(c.env.DB, project) }, 409);
 return c.json({ revision, policy });
});
inboundFilterRoutes.post('/preview', async c => {
 let input: any, policy;
 try {
  input = await jsonBody(c.req.raw, 65536);
  if (Object.keys(input).some(key => !['policy', 'after', 'limit'].includes(key))) throw new Error('Invalid preview fields');
  policy = validateInboundPolicy(input.policy);
  if (input.after !== undefined && (typeof input.after !== 'string' || !/^[a-zA-Z0-9._:-]{0,100}$/.test(input.after))) throw new Error('Invalid preview cursor');
  if (input.limit !== undefined && (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 500)) throw new Error('Preview page size must be between 1 and 500');
 } catch (error) { return c.json({ error: (error as Error).message }, 400); }
 return c.json(await previewInbound(c.env.DB, c.req.param('project')!, policy, { after: input.after ?? '', limit: input.limit ?? 100 }, c.env.AUTH_ORIGIN));
});
