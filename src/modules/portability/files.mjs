import { open, mkdir, link, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { readArchive } from './index.mjs';
import { canonicalJson } from './hash.mjs';
import { ledgerReader } from './ledgers.mjs';
export async function* fileRecords(path,reader=readArchive) {
 const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
 try { yield* reader(Readable.toWeb(file.createReadStream({ autoClose: false }))); }
 finally { await file.close(); }
}
function receipt(manifest, closing, transient) {
 return {
  contentHash: closing.contentHash,
  archiveHash: closing.archiveHash,
  tables: manifest.tables.map(({ name, count }) => ({ name, count })),
  objects: manifest.objects.length, payloads: manifest.payloads.length,
  exclusions: { tables: manifest.excludedTables, columns: manifest.excludedColumns, configuration: true, transient },
  requiredConfiguration: manifest.requiredConfiguration,
 };
}
// `progress` receives {phase, parts, total?, bytes?} events; the CLI turns them into lines (progress.mjs).
export async function exportArchive(service, path, transient, progress) {
 let id, temporary, file;
 try {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  temporary = path + '.' + randomUUID() + '.partial';
  file = await open(temporary, 'wx', 0o600);
  id = await service.exports.create();
  // The manifest leads the archive and holds the final part count and payload hashes, so
  // nothing can be written until every part is built (export.mjs advanceExport). One part per
  // advance keeps the progress line moving; a part is at most 16 MiB.
  let status;
  do {
   status = await service.exports.advance(id, { maxParts: 1 });
   progress?.({ phase: 'building', parts: status.completed, bytes: status.bytes, ...(status.phase === 'complete' ? { total: status.total } : {}) });
  } while (status.phase === 'building');
  const reader = (await service.exports.download(id)).getReader();
  try {
   // One chunk per record: the manifest, then each part, then the closing record.
   for (let record = 0, written = 0;; record++) {
    const { done, value } = await reader.read(); if (done) break;
    let offset = 0;
    while (offset < value.length) offset += (await file.write(value, offset)).bytesWritten;
    written += value.length;
    if (record > 0 && record <= status.total) progress?.({ phase: 'writing', parts: record, total: status.total, bytes: written });
   }
  } finally { await reader.cancel(); reader.releaseLock(); }
  await file.sync(); await file.close(); file = undefined;
  progress?.({ phase: 'checking', direction: 'export' });
  let manifest, closing;
  for await (const record of fileRecords(temporary)) { if (record.kind === 'manifest') manifest = record; if (record.kind === 'closing') closing = record; }
  await link(temporary, path);
  return receipt(manifest, closing, transient);
 } finally {
  await file?.close();
  if (temporary) await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (id) await service.exports.abort(id);
 }
}
export async function importArchive(service, path, transient, journal, progress) {
 let id, manifest, closing, complete = false, staged = 0;
 try {
  // Validate both complete archives before creating any restore state. An old
  // archive's own migration ledger places it in the destination's history
  // (bridge.mjs); import binds the rows read here to the parts it stages.
  let later;
  const ledger = ledgerReader();
  progress?.({ phase: 'checking', direction: 'import' });
  for (const file of [path, journal].filter(Boolean)) for await (const record of fileRecords(file)) {
   if (file === journal && record.kind === 'manifest') later = { sourceIdentity: record.sourceIdentity, epoch: record.epoch, journal: record.journal };
   if (file === path) ledger.add(record);
  }
  const ledgers = ledger.ledgers();
  for await (const record of fileRecords(path)) {
   if (record.kind === 'manifest') {
    manifest = record; id = await service.imports.create(manifest, undefined, ledgers ? { ledgers } : {});
    const { skippedTables } = await service.imports.status(id);
    if (skippedTables?.length) progress?.({ phase: 'skipped', tables: skippedTables });
   }
   else if (record.kind === 'part') {
    await service.imports.uploadPart(id, record.index, record);
    staged += Buffer.byteLength(canonicalJson(record)) + 1;
    progress?.({ phase: 'staging', parts: record.index + 1, total: manifest.partCount, bytes: staged });
   }
   else closing = record;
  }
  progress?.({ phase: 'finishing', total: manifest.partCount });
  const status = await service.imports.finalize(id, { contentHash: closing.contentHash, archiveHash: closing.archiveHash, ...(later ? { laterJournal: later } : {}) }); complete = true;
  return { ...receipt(manifest, closing, transient), ...(status.bridged ? { bridged: status.bridged } : {}), ...(status.skippedTables ? { skippedTables: status.skippedTables } : {}), ...(status.safetyChanges ? { safetyChanges: status.safetyChanges } : {}) };
 } finally { if (id && !complete) await service.imports.abort(id); }
}
