import { createErasure, defineErasure } from '../../modules/erasure/index.mjs';
import { eraseD1ImportTarget } from '../../modules/import-kit/src/d1/index.ts';
import type { D1ImportContext, D1RelatedErasure } from '../../modules/import-kit/src/d1/types.ts';
import type { SourceRecord } from '../../modules/import-kit/src/types.ts';
import { portability } from '../portability';
import { sentryTargets } from '../sentry-import/targets';
import { mappingVersion } from '../sentry-import/source';
import { projectErasure, erasureExceptions } from './declaration';
import { ownerErasureService } from './owner-service';
import { businessCustodyEdges } from './business-custody';

export async function projectErasureService(db: D1Database) {
 const transfer = await portability(db);
 const declaration=defineErasure({...projectErasure,edges:[...projectErasure.edges,...await businessCustodyEdges(db)]});
 return createErasure({ db, portability: transfer, declarations: [declaration] });
}

// Counts, times and declared exceptions only: no label, subject or stored value.
export function receiptView(receipt: any) {
 const { id, phase, planned, deleted, retained, blobs, requestedAt, committedAt, completedAt, seconds } = receipt;
 return { id, phase, planned, deleted, retained, blobs, requestedAt, committedAt, completedAt, seconds, exceptions: erasureExceptions };
}

// A project created by Sentry organization import keeps import-kit custody:
// its source records and the original export bytes. That custody, the project
// cascade and the portability fence commit in one import-kit batch.
async function importedProject(db: D1Database, project: string) {
 const row = await db.prepare("SELECT source FROM sentry_import_targets WHERE kind='project' AND id=?").bind(project).first<{ source: string }>();
 if (!row) return null;
 const source = JSON.parse(row.source) as { organization: string; project: string };
 return { organization: source.organization, slug: source.project };
}
function related({ organization, slug }: { organization: string; slug: string }): D1RelatedErasure {
 return {
  source(record: SourceRecord) {
   const payload = record.payload as any;
   if (payload?.organization !== organization) return false;
   if (record.kind === 'projects') return payload.data?.slug === slug;
   if (record.kind === 'releases') return Array.isArray(payload.data?.projects) && payload.data.projects.some((linked: any) => linked?.slug === slug);
   return payload.project === slug;
  },
  original(bytes: Uint8Array) {
   try {
    const bundle = JSON.parse(new TextDecoder().decode(bytes));
    return bundle?.organization?.slug === organization && Array.isArray(bundle.collections) && bundle.collections.some((collection: any) =>
     collection?.project === slug || (Array.isArray(collection?.pages) && collection.pages.some((page: any) => Array.isArray(page?.response) && page.response.some((item: any) => item?.slug === slug))));
   } catch { return false; }
  },
 };
}
function importContext(db: D1Database, session: any, organization: string): D1ImportContext {
 return { destination: 'spool-owner', namespace: `sentry-org:${organization}`, mappingVersion, batchSize: 10, maxBatches: 1,
  originalErasurePolicy: 'withdraw-affected-artifacts',
  storage: { database: db, targets: sentryTargets }, authorization: { principalId: session.operator.id, predicate() {
   return { sql: "EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND o.status='active' AND o.role='owner' AND s.operator_version=o.version)", params: [session.id, session.operator.id] };
  } } };
}

// Rows per atomic step. After its first step the helper works from a queue of
// the planned rows in deletion order, verifying only each step's slice, so the
// whole erasure stays linear in its rows; the step size only sets how many
// batches the retained-event cap (10,000 occurrences plus their children) takes.
const STEP_ROWS = 25_000;
/** Erase one project to completion within `until`, or leave it for the scheduled sweep. */
export async function eraseProject(db: D1Database, session: any, project: string, planHash: string, until: number) {
 const erasure = await projectErasureService(db);
 const imported = await importedProject(db, project);
 if (imported) {
  // Mirror start()'s checks; nativeStatements re-plans and refuses a held or open erasure.
  const preview = await erasure.preview('project', { id: project });
  if (preview.planHash !== planHash) return { status: 409 as const, error: 'plan_changed' };
  const { operationId, statements } = await erasure.nativeStatements('project', { id: project });
  await eraseD1ImportTarget('project', project, statements, importContext(db, session, imported.organization), related(imported));
  return { status: 200 as const, receipt: await erasure.deleteBlobs(operationId, { until }) };
 }
 const opened = await erasure.start('project', { id: project }, { planHash });
 return { status: 200 as const, receipt: await erasure.run(opened.id, { until, rows: STEP_ROWS }) };
}

/** Scheduled continuation for an erasure a request left unfinished. */
export async function continueErasures(db: D1Database, until: number) {
 const open = (await db.prepare("SELECT id,entity FROM rer_erasure_operations WHERE phase<>'complete' ORDER BY requested_at LIMIT 5").all<{ id: string; entity: string }>()).results;
 if (!open.length) return;
 const erasure = await projectErasureService(db);
 for (const { id,entity } of open) { if (Date.now() > until) break; await (entity==='installation-owner'?await ownerErasureService(db):erasure).run(id, { until, rows: STEP_ROWS }); }
}
