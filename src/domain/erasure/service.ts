import { createErasure, defineErasure, ErasureError } from '../../modules/erasure/index.mjs';
import { eraseD1ImportTarget } from '../../modules/import-kit/src/d1/index.ts';
import { targetIdentity } from '../../modules/import-kit/src/d1/erasure-index.ts';
import type { D1ImportContext, D1RelatedErasure } from '../../modules/import-kit/src/d1/types.ts';
import type { SourceRecord } from '../../modules/import-kit/src/types.ts';
import { portability } from '../portability';
import { sentryTargets } from '../sentry-import/targets';
import { mappingVersion } from '../sentry-import/source';
import { nativeProject } from '../sentry-import/mapping';
import { projectErasure, erasureExceptions } from './declaration';
import { ownerErasureService } from './owner-service';
import { businessCustodyEdges } from './business-custody';

const IMPORT_DESTINATION = 'spool-owner';

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

// A project created by Sentry organization import also keeps import-kit
// custody: its source records and the original export bytes. Its rows are
// recognised by the native project id their organization and slug map to, the
// same id the import gave the project, so no organization needs to survive the
// native cascade.
function related(project: string): D1RelatedErasure {
 const names = (organization: unknown, slug: unknown) => typeof organization === 'string' && typeof slug === 'string' && nativeProject(organization, slug) === project;
 return {
  source(record: SourceRecord) {
   const payload = record.payload as any;
   if (record.kind === 'projects') return names(payload?.organization, payload?.data?.slug);
   if (record.kind === 'releases') return Array.isArray(payload?.data?.projects) && payload.data.projects.some((linked: any) => names(payload.organization, linked?.slug));
   return names(payload?.organization, payload?.project);
  },
  original(bytes: Uint8Array) {
   try {
    const bundle = JSON.parse(new TextDecoder().decode(bytes)), organization = bundle?.organization?.slug;
    return Array.isArray(bundle?.collections) && bundle.collections.some((collection: any) => names(organization, collection?.project) ||
     (Array.isArray(collection?.pages) && collection.pages.some((page: any) => Array.isArray(page?.response) && page.response.some((item: any) => names(organization, item?.slug)))));
   } catch { return false; }
  },
 };
}
function importContext(db: D1Database, operationId: string): D1ImportContext {
 return { destination: IMPORT_DESTINATION, namespace: 'sentry-org:project-erasure', mappingVersion, batchSize: 10, maxBatches: 1,
  originalErasurePolicy: 'withdraw-affected-artifacts',
  storage: { database: db, targets: sentryTargets }, authorization: { principalId: `project-erasure:${operationId}`, predicate() {
   // The owner already confirmed this durable operation. A scheduled runner
   // can finish it without retaining an owner's session or personal identity.
   // import-kit checks the grant before AND after its transaction.
   return { sql: "EXISTS(SELECT 1 FROM rer_erasure_operations WHERE id=? AND entity='project' AND phase='blobs')", params: [operationId] };
  } } };
}

/** The project a committed operation erased. Base drops the subject when the
 * native cascade commits and keeps the root's key in its private scope until
 * completion, so the import custody step can still find it. */
async function erasedProject(db: D1Database, id: string) {
 const row = await db.prepare("SELECT key_json FROM rer_erasure_scope WHERE operation=? AND kind='graph' AND table_name='projects'").bind(id).first<{ key_json: string }>();
 return row ? JSON.parse(row.key_json).id as string : null;
}
/** Import custody still names the project until import-kit records its target tombstone. */
async function importCustodyHeld(db: D1Database, project: string) {
 const identity = targetIdentity(IMPORT_DESTINATION, 'project', project);
 return !!await db.prepare('SELECT 1 FROM ik_d1_plan_index WHERE target_identity=? AND NOT EXISTS(SELECT 1 FROM ik_d1_erased_targets WHERE destination=? AND identity=?) LIMIT 1').bind(identity, IMPORT_DESTINATION, identity).first();
}

// Every follow-up request commits one bounded step. It never waits for all
// 10,000 retained events; the receipt is the completion signal. An imported
// project erases the same way: Base's bounded steps delete the native graph,
// each row with its restore tombstone, and the door's private copies (a
// 150-issue import is thousands of statements, more than one D1 request can
// carry). Once that commits, one import-kit transaction withdraws the project's
// import custody, with its target, peer source records and originals, and only
// then may the blob phase complete the receipt. Every step is atomic; a failed
// step leaves the operation where it was, so the next request retries it.
const STEP_ROWS = 500;
export async function startProjectErasure(db: D1Database, project: string, planHash: string) {
 return (await projectErasureService(db)).start('project', { id: project }, { planHash });
}

export async function resumeProjectErasure(db: D1Database, id: string) {
 const erasure = await projectErasureService(db);
 const operation = await db.prepare("SELECT phase FROM rer_erasure_operations WHERE id=? AND entity='project'").bind(id).first<{phase: string}>();
 if (!operation) throw new ErasureError('erasure_not_found', 404);
 if (operation.phase === 'complete') return erasure.receipt(id);
 if (operation.phase === 'deleting' && (await erasure.commit(id, { rows: STEP_ROWS, until: 0 })).phase === 'deleting') return erasure.receipt(id);
 const project = await erasedProject(db, id);
 if (project && await importCustodyHeld(db, project)) await eraseD1ImportTarget('project', project, [], importContext(db, id), related(project));
 // Blob verification and the final fenced re-read alone may mark complete.
 return erasure.deleteBlobs(id, { until: 0 });
}

// One bounded owner step, then, once its rows are gone, the blob phase under the sweep's deadline.
async function stepOwnerErasure(db: D1Database, id: string, until: number) {
 const erasure = await ownerErasureService(db), after = await erasure.run(id, { until: 0, rows: STEP_ROWS });
 return after.phase === 'blobs' ? erasure.run(id, { until, rows: STEP_ROWS }) : after;
}

/** Scheduled continuation also finishes jobs after the client disconnects. It
 * shares the runtime with requests, so it commits one bounded step at a time
 * and gives waiting requests their turn after each: a local runtime (one
 * thread, D1 in process) answers no other request while the sweep's D1 calls
 * run, and closes a request it has held past its 15-second header timeout. */
export async function continueErasures(db: D1Database, until: number) {
 const open = (await db.prepare("SELECT id,entity FROM rer_erasure_operations WHERE phase<>'complete' ORDER BY requested_at LIMIT 5").all<{ id: string; entity: string }>()).results;
 for (const { id,entity } of open) {
  while (Date.now() <= until) {
   try {
    const receipt = entity === 'installation-owner' ? await stepOwnerErasure(db, id, until) : await resumeProjectErasure(db, id);
    if (receipt.phase === 'complete') break;
   } catch (error) {
    // A client or another scheduled invocation owns this step. Its atomic
    // guard keeps the job resumable; the next invocation reads fresh progress.
    if (error instanceof ErasureError && error.code === 'erasure_busy') break;
    throw error;
   }
   await new Promise(resolve => setTimeout(resolve, 0));
  }
 }
}
