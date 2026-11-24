import { PortabilityError, type Portability } from '../modules/portability/index.mjs';
import { archiveProgressByte } from './archive-progress';

export type ArchiveRequestLifetime = {
 signal: AbortSignal;
 waitUntil: (work: Promise<unknown>) => void;
};

type ArchiveService = {
 exports: Portability['exports'] & {
  advance: (id: string, options: Parameters<Portability['exports']['advance']>[1], presentation: { includeOrderedHash: boolean }) => ReturnType<Portability['exports']['advance']>;
 };
};

export async function archiveStream(service: ArchiveService, lifetime?: ArchiveRequestLifetime): Promise<ReadableStream<Uint8Array>> {
 const signal = lifetime?.signal;
 let id: string | undefined;
 let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
 let closing: Promise<void> | undefined;
 const prepare = (async () => {
  id = await service.exports.create(undefined, { signal });
  // A one-shot download uses the checksum in the closing record.
  while ((await service.exports.advance(id, { maxParts: 16, signal }, { includeOrderedHash: false })).phase === 'building') {}
  signal?.throwIfAborted();
  return reader = (await service.exports.download(id)).getReader();
 })();
 // Keep an in-flight snapshot write alive until it can finish or be cleaned up.
 lifetime?.waitUntil(prepare.then(() => {}, () => {}));
 const cleanup = () => {
  if (closing) return closing;
  signal?.removeEventListener('abort', cleanup);
  closing = (async () => {
   await prepare.catch(() => {});
   try { await reader?.cancel(); }
   finally {
    if (id) {
     try { await service.exports.abort(id); }
     catch (error) {
      // Retention or erasure may already have removed the job and its copies.
      if (!(error instanceof PortabilityError) || error.code !== 'job_not_found') throw error;
     }
    }
   }
  })();
  lifetime?.waitUntil(closing);
  return closing;
 };
 signal?.addEventListener('abort', cleanup, { once: true });
 try {
  const source = await prepare;
  signal?.throwIfAborted();
  return new ReadableStream({
   async pull(controller) {
    try {
     const next = await source.read();
     signal?.throwIfAborted();
     if (next.done) {
      await cleanup();
      signal?.throwIfAborted();
      controller.close();
     } else controller.enqueue(next.value);
    } catch (error) {
     try { await cleanup(); }
     finally { controller.error(error); }
    }
   },
   cancel: cleanup,
  });
 } catch (error) {
  await cleanup();
  throw error;
 }
}

/** The acknowledgement carries no evidence. The archive still goes through the
 * same snapshot, audit and cancellation path after the response can flush. */
export function archiveWithProgress(
 prepare: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>,
 signal: AbortSignal,
): ReadableStream<Uint8Array> {
 const canceled = new AbortController();
 const lifetime = AbortSignal.any([signal, canceled.signal]);
 let ready: Promise<ReadableStreamDefaultReader<Uint8Array>> | undefined;
 return new ReadableStream({
  start(controller) { controller.enqueue(Uint8Array.of(archiveProgressByte)); },
  async pull(controller) {
   const reader = await (ready ??= prepare(lifetime).then(source => source.getReader()));
   const next = await reader.read();
   if (next.done) controller.close();
   else controller.enqueue(next.value);
  },
  async cancel(reason) {
   canceled.abort(reason);
   const reader = await ready?.catch(() => undefined);
   await reader?.cancel(reason);
  },
 });
}
