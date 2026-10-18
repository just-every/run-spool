import { createErasure, defineErasure, ErasureError } from '../../modules/erasure/index.mjs';
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
function importContext(db: D1Database, operationId: string, organization: string): D1ImportContext {
 return { destination: 'spool-owner', namespace: `sentry-org:${organization}`, mappingVersion, batchSize: 10, maxBatches: 1,
  originalErasurePolicy: 'withdraw-affected-artifacts',
  storage: { database: db, targets: sentryTargets }, authorization: { principalId: `project-erasure:${operationId}`, predicate() {
   // The owner already confirmed this durable operation. A scheduled runner
   // can finish it without retaining an owner's session or personal identity.
   // The grant survives publication: import-kit checks it before AND after
   // the transaction clears the subject and advances the receipt phase.
   return { sql: "EXISTS(SELECT 1 FROM rer_erasure_operations WHERE id=? AND entity='project')", params: [operationId] };
  } } };
}

// Every follow-up request commits one bounded step. It never waits for all
// 10,000 retained events; the receipt is the completion signal.
const STEP_ROWS = 500;
export async function startProjectErasure(db: D1Database, project: string, planHash: string) {
 return (await projectErasureService(db)).start('project', { id: project }, { planHash });
}

export async function resumeProjectErasure(db: D1Database, id: string) {
 const erasure = await projectErasureService(db);
 const operation = await db.prepare("SELECT subject,phase FROM rer_erasure_operations WHERE id=? AND entity='project'").bind(id).first<{subject: string | null; phase: string}>();
 if (!operation) throw new ErasureError('erasure_not_found', 404);
 if (operation.phase === 'complete') return erasure.receipt(id);
 const project = operation.subject ? JSON.parse(operation.subject).id as string : null;
 const imported = project ? await importedProject(db, project) : null;
 if (imported && project) {
  // Custody withdrawal, native cascade and all tombstones still publish in
  // one import-kit transaction, now as continuation of the accepted job.
  const { statements } = await erasure.nativeStatements('project', { id: project }, { operationId: id });
  await eraseD1ImportTarget('project', project, statements, importContext(db, id, imported.organization), related(imported));
 } else if (operation.phase === 'deleting') {
  await erasure.commit(id, { rows: STEP_ROWS, until: 0 });
 }
 // Blob verification and the final fenced re-read alone may mark complete.
 return erasure.deleteBlobs(id, { until: 0 });
}

/** Scheduled continuation also finishes jobs after the client disconnects. */
export async function continueErasures(db: D1Database, until: number) {
 const open = (await db.prepare("SELECT id,entity FROM rer_erasure_operations WHERE phase<>'complete' ORDER BY requested_at LIMIT 5").all<{ id: string; entity: string }>()).results;
 for (const { id,entity } of open) {
  while (Date.now() <= until) {
   try {
    const receipt = entity === 'installation-owner' ? await (await ownerErasureService(db)).run(id, { until, rows: STEP_ROWS }) : await resumeProjectErasure(db, id);
    if (receipt.phase === 'complete') break;
   } catch (error) {
    // A client or another scheduled invocation owns this step. Its atomic
    // guard keeps the job resumable; the next invocation reads fresh progress.
    if (error instanceof ErasureError && error.code === 'erasure_busy') break;
    throw error;
   }
  }
 }
}
