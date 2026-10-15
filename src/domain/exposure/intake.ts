import { authorizeIngest, ingestBatch, ingestFailure, recordIngest, stmt } from '../admission';
import { jsonBody } from '../owner-router';
import { exposureInput } from './report';
import { exposureStatements } from './storage';

// POST /api/ingest/:project/exposure with the project's ingest key: this client
// reached these flows in this registered release. Each refused report is
// counted, because lost exposure is itself a capture gap.
export async function exposureResponse(c: any) {
 const project = c.req.param('project');
 const auth = await authorizeIngest(c, project, c.req.header('authorization')?.replace(/^Bearer /, ''));
 if ('response' in auth) return auth.response;
 const { scope } = auth, db = c.env.DB;
 let report;
 try { report = exposureInput(await jsonBody(c.req.raw, 4096)); }
 catch (error) { await recordIngest(c, scope, 'exposure_invalid'); return c.json({ outcome: 'rejected', reason: String((error as Error).message) }, 400); }
 const release = await stmt(db, 'SELECT build FROM releases WHERE project=? AND name=?', project, report.release).first<any>();
 if (!release || release.build !== report.build) { await recordIngest(c, scope, 'exposure_unregistered'); return c.json({ outcome: 'rejected', reason: 'unregistered_release_or_build' }, 422); }
 const time = Date.now();
 let evicted = 0;
 try {
  const result = await ingestBatch(c, scope, exposureStatements(db, project, report, time));
  // The first batch statement checks authority; the third deletes old rows.
  evicted = result[2].meta.changes;
 } catch (error) {
  if (String((error as Error).message).includes('exposure_budget')) { await recordIngest(c, scope, 'exposure_budget'); return c.json({ outcome: 'dropped', reason: 'exposure_budget' }, 429); }
  return ingestFailure(c, scope, error);
 }
 return c.json({ outcome: 'accepted', flows: report.flows.length, evicted }, 201);
}
