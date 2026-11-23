import { currentAuditScope } from './context';
import { recordAudit } from './record';
import type { AuditOutcome } from './types';
import type { ArchiveRequestLifetime } from '../archive-stream';

/** An export is an effect outside the database: `started` is recorded before
 * the first byte leaves, then exactly one terminal outcome. A stream that ends
 * without either (the Worker stops) leaves `started` alone, never a success. */
export async function auditedExport(db: D1Database, source: ReadableStream<Uint8Array>, { signal, waitUntil }: ArchiveRequestLifetime): Promise<ReadableStream<Uint8Array>> {
 const scope = currentAuditScope();
 const base = { source: 'request' as const, actor: scope.actor, action: scope.action, subject: scope.subject, projectLabel: scope.projectLabel };
 let finished = false;
 const finish = async (outcome: AuditOutcome) => {
  if (finished) return;
  finished = true;
  const recorded = recordAudit(db, { ...base, outcome: signal.aborted ? 'uncertain' : outcome });
  waitUntil(recorded);
  await recorded;
 };
 try { await recordAudit(db, { ...base, outcome: 'started' }); }
 catch (error) { await source.cancel(); throw error; }
 const reader = source.getReader();
 return new ReadableStream<Uint8Array>({
  async pull(controller) {
   try { const next = await reader.read(); if (next.done) { await finish('succeeded'); controller.close(); } else controller.enqueue(next.value); }
   catch (error) { await finish('failed'); controller.error(error); }
  },
  async cancel(reason) { try { await finish('uncertain'); } finally { await reader.cancel(reason); } },
 });
}
