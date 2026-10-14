import { operatorTables } from './operators/archive';
import { createPortability, readArchive, makePart, canonicalJson, sha256, PortabilityError } from '../modules/portability/index.mjs';
import { catalogue, policy } from '../modules/portability/catalogue.mjs';
import { ArchiveVerifier } from '../modules/portability/format.mjs';
import { alertArchiveTables, alertExcludedTables, alertExportRow, validateAlertArchive } from './alerts/archive';
import { validateArchive, validateArchiveRows, tables } from './archive';
import { repairArchiveTables, validateRepairArchive } from './repairs/archive';
import { erasureArchiveTables, erasureExcludedTables, validateErasureArchive } from './erasure/archive';
import { fenceLegacyOccurrences } from './occurrences';
import { scrubExportRow } from './stored-text';
import { isPreviousSchema, readPreviousArchive, normalizePreviousArchive } from './archive-compat';
import { linkArchiveTables, linkMigrations, emptyLinkTables } from './link-archive';

function stagedValidation(later: string[] = []) {
 return async ({ db, read, manifest }: { db: D1Database; read: (table: string) => Promise<any[]>; manifest: any }) => {
  const rows=Object.fromEntries(await Promise.all([...Object.keys(tables),...alertArchiveTables,...repairArchiveTables,...erasureArchiveTables].map(async table => [table, await read(table)])));
  const data=await validateArchiveRows(validateAlertArchive(validateRepairArchive(validateErasureArchive(rows))));
  await fenceLegacyOccurrences(db, manifest, data, later);
  return true;
 };
}

export const portabilityPolicy = {
 product: 'runeditrun/errors-workbench', excludeTables: ['credentials', 'sessions', 'login_budget', 'browser_origin_guards','spool_authority_guards','operator_guards','ik_%', ...alertExcludedTables, ...erasureExcludedTables],
 exportRow: (table: string, row: any) => scrubExportRow(table, alertExportRow(table, row)),
 requiredConfiguration: ['OWNER_EMAIL', 'SESSION_SECRET', 'SETUP_TOKEN', 'AUTH_ORIGIN', 'AUTH_LOCAL', 'MAIL_PROVIDER', 'MAIL_FROM', 'ALERT_DESTINATIONS', 'ALERT_DESTINATION_HASH_KEY', 'ALERT_PUBLIC_ORIGIN', 'INTEGRATION_EGRESS'],
 validateStaged: stagedValidation(),
};
export async function portability(db: D1Database) {
 const service = await createPortability({ db, policy: portabilityPolicy });
 return { ...service, db, imports: { ...service.imports,
  async finalize(id: string, options?: any) {
   // Include an explicitly supplied later journal in the legacy-key fence too.
   // Base still validates that journal and enforces its normal epoch/key fence.
   const checked = options?.laterJournal ? await createPortability({ db, policy: { ...portabilityPolicy, validateStaged: stagedValidation(options.laterJournal.journal) } }) : service;
   return checked.imports.finalize(id, options);
  },
 } };
}
export async function archiveStream(service: any): Promise<ReadableStream<Uint8Array>> {
 const id = await service.exports.create();
 try {
  while ((await service.exports.advance(id, { maxParts: 16 })).phase === 'building') {}
  const reader = (await service.exports.download(id)).getReader();
  let ended = false;
  const cleanup = async () => { if (!ended) { ended = true; await reader.cancel(); await service.exports.abort(id); } };
  return new ReadableStream({
   async pull(controller) { try { const next = await reader.read(); if (next.done) { await cleanup(); controller.close(); } else controller.enqueue(next.value); } catch (error) { await cleanup(); controller.error(error); } },
   cancel: cleanup,
  });
 } catch (error) { await service.exports.abort(id); throw error; }
}
// Archives from before later additive tables (the identity link's two in
// 0020, erasure receipts in 0018, and before that the two repair tables in 0016) carry exactly today's inventory
// minus those tables. Their verified rows restore unchanged into today's
// schema; the later tables start empty.
// Each set names the additive migrations that created it; an archive that
// records its applied migrations gains exactly those, nothing else.
const operatorNames=Object.keys(operatorTables);
const operatorMigration='0031_operator_corrections.sql';
const laterTables = [
 {tables:operatorNames,migrations:[operatorMigration]},
 { tables: [...operatorNames,...linkArchiveTables], migrations: [operatorMigration,...linkMigrations] },
 { tables: [...operatorNames,...erasureArchiveTables, ...linkArchiveTables], migrations: [operatorMigration,'0018_erasure.sql', ...linkMigrations] },
 { tables: [...operatorNames,...erasureArchiveTables, ...repairArchiveTables, ...linkArchiveTables], migrations: [operatorMigration,'0016_repairs.sql', '0018_erasure.sql', ...linkMigrations] },
];
async function earlierManifest(db: D1Database, manifest: any) {
 const current = await catalogue(db, policy(portabilityPolicy));
 if (manifest?.kind !== 'manifest') return null;
 for (const later of laterTables) {
  const earlier = current.tables.filter((table: any) => !later.tables.includes(table.name));
  if (manifest.schema !== await sha256(canonicalJson(earlier.map(({ name, sql }: any) => ({ name, sql }))))) continue;
  if (!Array.isArray(manifest.tables) || canonicalJson(manifest.tables.map(({ count, ...table }: any) => table)) !== canonicalJson(earlier)) throw new PortabilityError('legacy_column_inventory');
  const migrations = Array.isArray(manifest.migrations) ? { migrations: [...manifest.migrations, ...later.migrations.filter(name => !manifest.migrations.includes(name))] } : {};
  return { ...manifest, ...migrations, schema: current.identity, tables: current.tables.map((table: any) => ({ ...table, count: manifest.tables.find((old: any) => old.name === table.name)?.count ?? 0 })) };
 }
 return null;
}
async function importRecords(service: any, source: ReadableStream<Uint8Array>, db?: D1Database, laterJournal?: LaterJournal) {
 let id, closing, binding: any, complete = false;
 try {
  for await (const record of readArchive(source)) {
   if (record.kind === 'manifest') { const manifest = db ? await earlierManifest(db, record) : record; binding = new ArchiveVerifier(manifest); id = await service.imports.create(manifest); }
   else if (record.kind === 'part') { binding.add(record); await service.imports.uploadPart(id, record.index, record); }
   else closing = record;
  }
  if (!closing) throw new Error('Archive closing record missing');
  // A rewritten earlier manifest has new content and archive hashes;
  // readArchive has already verified the original archive's closing hashes
  // above, and finalize binds the staged parts to the manifest actually created.
  await service.imports.finalize(id, { archiveHash: binding.digest(), ...(db ? {} : { contentHash: closing.contentHash }), ...(laterJournal ? { laterJournal } : {}) }); complete = true;
 } finally { if (id && !complete) await service.imports.abort(id); }
}
async function templateManifest(service:any){
 let manifest:any;for await(const record of readArchive(await archiveStream(service)))if(record.kind==='manifest')manifest=record;
 return manifest;
}
async function legacyRecords(service: any, value: unknown) {
 const legacy=await validateArchive(value);
 const data:Record<string,any[]>={...legacy,alerts:legacy.alerts.map((row:any)=>({...row,payload:null})),alert_rules:[],alert_history:[],repairs:[],repair_checks:[],rer_erasure_operations:[],...emptyLinkTables()};
 const template=await templateManifest(service);
 return restoreRows(service,data,{...template,sourceIdentity:crypto.randomUUID(),epoch:0,journal:[],exportedAt:new Date().toISOString()});
}
async function restoreRows(service:any,data:Record<string,any[]>,input:any){
 const manifest={...input,tables:input.tables.map((table:any)=>({...table,count:data[table.name].length}))};
 const parts: any[] = []; let items: any[] = [], size = 0;
 for (const table of manifest.tables) for (const [index, row] of data[table.name].entries()) {
  const item = { kind: 'row', table: table.name, index, row, ...(table.rowidAlias ? { rowid: index + 1 } : {}) };
  const bytes = new TextEncoder().encode(JSON.stringify(item)).length;
  if (items.length && (size + bytes > 1024 * 1024 || items.length >= 500)) { parts.push(await makePart(parts.length, items)); items = []; size = 0; }
  items.push(item); size += bytes;
 }
 if (items.length) parts.push(await makePart(parts.length, items));
 manifest.partCount = parts.length;
 let id, complete = false;
 const binding = new ArchiveVerifier(manifest); for (const part of parts) binding.add(part);
 try { id = await service.imports.create(manifest); for (const part of parts) await service.imports.uploadPart(id, part.index, part); await service.imports.finalize(id, { archiveHash: binding.digest() }); complete = true; }
 finally { if (id && !complete) await service.imports.abort(id); }
}
export type LaterJournal = { sourceIdentity: string; epoch: number; journal: string[] };
/** A later archive of the same installation: its verified manifest's erasure journal also fences this restore. */
export async function laterJournalOf(source: ReadableStream<Uint8Array>): Promise<LaterJournal> {
 let later: LaterJournal | undefined;
 for await (const record of readArchive(source)) if (record.kind === 'manifest') later = { sourceIdentity: record.sourceIdentity, epoch: record.epoch, journal: record.journal };
 if (!later) throw new PortabilityError('later_journal');
 return later;
}
export async function restoreStream(service: any, source: ReadableStream<Uint8Array>, laterJournal?: LaterJournal) {
 const [probe, input] = source.tee();
 const reader = probe.getReader(); let prefix = '', done = false;
 try {
  while (!prefix.includes('\n') && !done && prefix.length <= 16 * 1024 * 1024) {
   const chunk = await reader.read(); done = chunk.done; if (chunk.value) prefix += new TextDecoder().decode(chunk.value, { stream: !done });
  }
 } finally { void reader.cancel(); }
 let first; try { first = JSON.parse(prefix.split('\n')[0]); } catch { /* Pretty legacy JSON is decoded below. */ }
 // Only a current or later-additive archive carries the journal identity a later archive can extend.
 if(laterJournal&&(first?.kind!=='manifest'||isPreviousSchema(first.schema)))throw new PortabilityError('later_journal');
 if(first?.kind==='manifest'&&isPreviousSchema(first.schema)){
  const previous=await readPreviousArchive(input);
  const normalized=await normalizePreviousArchive(previous,await templateManifest(service));
  return restoreRows(service,normalized.data,normalized.manifest);
 }
 if (first?.kind === 'manifest') return importRecords(service, input, await earlierManifest(service.db, first) ? service.db : undefined, laterJournal);
 const legacyReader = input.getReader(); let count = 0, text = ''; const decoder = new TextDecoder();
 try {
  for (;;) { const next = await legacyReader.read(); if (next.done) break; count += next.value.length; if (count > 16 * 1024 * 1024) throw new Error('Legacy archive exceeds 16 MiB'); text += decoder.decode(next.value, { stream: true }); }
  text += decoder.decode(); return await legacyRecords(service, JSON.parse(text));
 } finally { await legacyReader.cancel(); }
}
