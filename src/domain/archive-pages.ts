import { excludedTables as portabilityExclusions, PortabilityError } from '../modules/portability/index.mjs';
import { FORMAT } from '../modules/portability/format.mjs';
import { encodedRow, excludedTable, mapRow, projectedColumns } from '../modules/portability/catalogue.mjs';
import { platformOrigin, readLedger } from '../modules/portability/ledgers.mjs';
import { guard, quote } from '../modules/portability/storage.mjs';
import { auditColumns, projectAuditRow, SAFE_AUDIT_PAYLOAD } from './audit/archive';
import { currentAuditScope } from './audit/context';
import { auditStatement } from './audit/record';
import { authorityGuard, type OwnerSession } from './owner-authority';
import { portabilityPolicy } from './portability';

const kind = 'browser-export';
const lifetime = 30 * 60_000;
const byteBudget = 96 * 1024;
const auditTable = 'spool_audit_events';
const prefix = (id: string) => 'rer_portability_snap_browser_' + id.replaceAll('-', '') + '_';
const schema = (id: string) => quote(prefix(id) + 'schema');
const copiedRows = (id: string) => quote(prefix(id) + 'rows');
const policy = { secretColumns: {} as Record<string, string[]>, ...portabilityPolicy };
// Spool has no table inclusion overrides; compile the shared exclusions once.
const exclusions = [...portabilityExclusions, ...policy.excludeTables];
const exactExclusions = new Set(exclusions.filter(name => !name.endsWith('%')).map(name => name.toLowerCase()));
const excludedPrefixes = exclusions.filter(name => name.endsWith('%')).map(name => name.slice(0, -1).toLowerCase());
function excluded(name: string) {
 const lower = name.toLowerCase();
 return exactExclusions.has(lower) || excludedPrefixes.some(prefix => lower.startsWith(prefix))
  || (lower.startsWith('oc_') && excludedTable(name, policy));
}
const catalogFilter = "sql IS NOT NULL AND substr(lower(name),1,7)<>'sqlite_' AND substr(lower(name),1,4)<>'_cf_'";
const inventorySql = `SELECT name,
 (SELECT json_group_array(name) FROM (SELECT p.name FROM pragma_table_xinfo(sm.name) p ORDER BY cid)) AS fields
 FROM sqlite_master sm WHERE ${catalogFilter} AND type='table'
 AND name NOT GLOB 'rer_portability_snap_*' AND name NOT GLOB 'rer_portability_stage_*' ORDER BY name`;
const jobId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

type Inventory = { name: string; fields: string };
type Snapshot = { tables: Inventory[]; inventory: string[]; until: number; epoch: number; sourceIdentity: string; startAuditId: string };
type Column = { name: string; type: string; pk: number; notnull: number; hidden: number };
type Table = { name: string; columns: ReturnType<typeof columns>; rowidAlias: string | null };
function columns(value: string) {
 return (JSON.parse(value) as Column[]).map(({ hidden, ...column }) =>
  hidden ? { ...column, generated: hidden === 2 ? 'virtual' : 'stored' } : column);
}

function archiveFact(db: D1Database, outcome: 'started' | 'succeeded' | 'uncertain', id?: string) {
 const { actor, action, subject, projectLabel } = currentAuditScope();
 return auditStatement(db, { source: 'request', actor, action, subject, projectLabel, outcome, id });
}

export async function expireBrowserArchives(db: D1Database, time: number) {
 const { results } = await db.prepare("SELECT id FROM rer_portability_jobs WHERE kind=? AND json_extract(metadata,'$.until')<=? LIMIT 4").bind(kind, time).all<{ id: string }>();
 for (const { id } of results) await removeSnapshot(db, id);
}

async function start(db: D1Database, session: OwnerSession, signal: AbortSignal) {
 const time = Date.now();
 const [[inventory, current], ledger] = await Promise.all([
  db.batch([
   db.prepare(inventorySql),
   db.prepare('SELECT source_identity,epoch,applying FROM rer_portability_state WHERE id=1'),
  ]),
  readLedger(db),
 ]);
 const all = inventory.results as Inventory[];
 const excludedTables = all.map(row => row.name).filter(excluded);
 const tables = all.filter(row => !excludedTables.includes(row.name));
 const { source_identity: existingSource, epoch = 0, applying = 0 } = (current.results[0] ?? {}) as { source_identity?: string; epoch?: number; applying?: number };
 if (applying) throw new PortabilityError('import_applying', 409);
 const sourceIdentity = existingSource ?? crypto.randomUUID();
 const id = crypto.randomUUID();
 const exportedAt = new Date(time).toISOString();
 const origin = await platformOrigin(ledger);
 const migrations = origin?.entries.map((entry: { name: string }) => entry.name) ?? ledger?.entries.map((entry: { name: string }) => entry.name);
 const manifest = {
  kind: 'manifest', format: FORMAT, version: 2, product: policy.product,
  exportedAt, sourceIdentity, epoch, requiredConfiguration: policy.requiredConfiguration,
  excludedTables, excludedColumns: policy.secretColumns, objects: [],
  ...(migrations ? { migrations } : {}), ...(origin ? { migrationLedger: origin } : {}),
 };
 signal.throwIfAborted();
 const startAuditId = crypto.randomUUID();
 const metadata = { startAuditId, tables, inventory: all.map(row => row.name), tableCount: tables.length, until: time + lifetime, epoch, sourceIdentity };
 await db.batch([
  authorityGuard(db, session),
  db.prepare('INSERT OR IGNORE INTO rer_portability_state(id,source_identity) VALUES(1,?)').bind(sourceIdentity),
  guard(db, 'EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND applying=0 AND source_identity=? AND epoch=?)', sourceIdentity, epoch),
  db.prepare("INSERT INTO rer_portability_jobs(id,kind,actor,phase,metadata) VALUES(?,?,?,'planning',?)")
   .bind(id, kind, session.operator.id, JSON.stringify(metadata)),
  archiveFact(db, 'started', startAuditId),
  db.prepare('DELETE FROM rer_portability_guard'),
  db.prepare('DELETE FROM spool_authority_guards'),
 ]);
 if (signal.aborted) {
  await removeSnapshot(db, id, 'uncertain');
  signal.throwIfAborted();
 }
 return Response.json({ id, manifest, audit: SAFE_AUDIT_PAYLOAD });
}

// All rows and their schema commit together. The storage prefix participates
// in the existing retention, scrubbing and erasure invalidation.
const tableColumns = (name: string) => `(SELECT json_group_array(json_object('name',p.name,'type',p.type,'pk',p.pk,'notnull',p.[notnull],'hidden',p.hidden))
 FROM (SELECT * FROM pragma_table_xinfo(${name}) ORDER BY cid) p)`;
async function capture(db: D1Database, session: OwnerSession, id: string, snapshot: Snapshot) {
 const { tables, sourceIdentity, epoch, startAuditId } = snapshot;
 const descriptions = [...tables.map(({ name, fields }) => ({ name, fields: JSON.parse(fields) as string[] })),
  { name: auditTable, fields: [...auditColumns] }];
 const width = Math.max(...descriptions.map(table => table.fields.length));
 if (width > 97) throw new PortabilityError('archive_column_limit', 409);
 const slotNames = Array.from({ length: width }, (_, index) => 'c' + index);
 const store = copiedRows(id);
 const rowSelects = descriptions.map(({ name, fields }, ordinal) => {
  const cells = fields.map(field => '+' + quote(field)).join(',') + ',NULL'.repeat(width - fields.length);
  // An explicit cursor also accommodates tables that contain negative rowids.
  return `SELECT ${ordinal}, ROW_NUMBER() OVER (ORDER BY rowid), rowid, ${cells} FROM ${quote(name)}${name === auditTable ? ' WHERE id<>?' : ''}`;
 });
 const groups = [];
 // Use independent per-table queries underneath each compound SELECT.
 for (let i = 0; i < rowSelects.length; i += 5) groups.push(`SELECT * FROM (${rowSelects.slice(i, i + 5).join(' UNION ALL ')})`);
 const writes = [];
 for (let i = 0; i < groups.length; i += 5) {
  const command = db.prepare(`INSERT INTO ${store} ${groups.slice(i, i + 5).join(' UNION ALL ')}`);
  writes.push(i + 5 >= groups.length ? command.bind(startAuditId) : command);
 }
 const results = await db.batch([
  authorityGuard(db, session),
  guard(db, `EXISTS(SELECT 1 FROM rer_portability_jobs j JOIN rer_portability_state s
   ON s.id=1 AND s.applying=0 AND s.source_identity=? AND s.epoch=?
   WHERE j.id=? AND j.kind=? AND j.actor=? AND j.phase='planning')`, sourceIdentity, epoch, id, kind, session.operator.id),
  guard(db, `(SELECT json_group_array(name) FROM (
   SELECT name FROM sqlite_master WHERE ${catalogFilter} AND type='table' AND name NOT GLOB 'rer_portability_snap_*'
    AND name NOT GLOB 'rer_portability_stage_*' ORDER BY name))=?`, JSON.stringify(snapshot.inventory)),
  db.prepare(`CREATE TABLE ${store}(ordinal INTEGER, cursor INTEGER, source_rowid INTEGER, ${slotNames.join(',')},
   PRIMARY KEY(ordinal,cursor)) WITHOUT ROWID`),
  ...writes,
  db.prepare(`CREATE TABLE ${schema(id)} AS
   WITH plan AS MATERIALIZED (SELECT key AS ordinal,value AS table_name FROM json_each(?))
   SELECT name,sql,type,tbl_name,
    CASE WHEN type='table' THEN ${tableColumns('sm.name')} END AS columns,
    CASE WHEN type='table' THEN
     (SELECT json_group_array(DISTINCT f.[table]) FROM pragma_foreign_key_list(sm.name) f) END AS dependencies
   FROM sqlite_master sm WHERE ${catalogFilter} AND (type IN ('index','trigger','view') OR name IN (SELECT table_name FROM plan))
   ORDER BY CASE WHEN type='table' THEN 0 ELSE 1 END,name,type`).bind(JSON.stringify(tables.map(table => table.name))),
  guard(db, `NOT EXISTS(SELECT 1 FROM json_each(?) t JOIN ${schema(id)} captured
   ON captured.rowid=t.key+1 WHERE json_extract(t.value,'$.name')<>captured.name
    OR json_extract(t.value,'$.fields') IS NOT (SELECT json_group_array(json_extract(value,'$.name')) FROM json_each(captured.columns)))`, JSON.stringify(tables)),
  db.prepare("UPDATE rer_portability_jobs SET phase='complete' WHERE id=?").bind(id),
  db.prepare('DELETE FROM rer_portability_guard'),
  db.prepare('DELETE FROM spool_authority_guards'),
  db.prepare('SELECT tombstone FROM rer_portability_journal WHERE source=? ORDER BY tombstone').bind(sourceIdentity),
 ]);
 return Response.json({ journal: (results.at(-1)!.results as { tombstone: string }[]).map(row => row.tombstone) });
}

async function removeSnapshot(db: D1Database, id: string, outcome?: 'succeeded' | 'uncertain') {
 await db.batch([
  ...(outcome ? [guard(db, 'EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=? AND kind=?)', id, kind), archiveFact(db, outcome)] : []),
  db.prepare(`DROP TABLE IF EXISTS ${schema(id)}`),
  db.prepare(`DROP TABLE IF EXISTS ${copiedRows(id)}`),
  db.prepare('DELETE FROM rer_portability_jobs WHERE id=? AND kind=?').bind(id, kind),
  ...(outcome ? [db.prepare('DELETE FROM rer_portability_guard')] : []),
 ]);
}

async function getSnapshot(db: D1Database, id: string, session: OwnerSession, capture: boolean) {
 const row = await db.prepare(`SELECT j.phase,json_extract(j.metadata,'$.tableCount') AS tableCount,
  CASE WHEN ? THEN j.metadata END AS metadata FROM rer_portability_jobs j JOIN rer_portability_state s
  ON s.id=1 AND s.applying=0 AND s.epoch=json_extract(j.metadata,'$.epoch')
  WHERE j.id=? AND j.kind=? AND j.actor=? AND json_extract(j.metadata,'$.until')>?`)
  .bind(Number(capture), id, kind, session.operator.id, Date.now()).first<{ metadata: string | null; phase: string; tableCount: number }>();
 if (!row) throw new PortabilityError('archive_unavailable', 409);
 return row;
}

type SchemaRow = { cursor: number; more: number; name: string; sql: string; type: string; tbl_name: string; columns: string; dependencies: string; count: number; ordinal: number };
function tableMetadata(row: SchemaRow): Table {
 const fields = columns(row.columns);
 return { name: row.name, columns: fields,
  rowidAlias: fields.some(field => field.pk) ? null : ['rowid', '_rowid_', 'oid'].find(alias => !fields.some(field => field.name.toLowerCase() === alias)) ?? null };
}

async function schemaPage(db: D1Database, id: string, cursor: number) {
 const stored = copiedRows(id);
 const { results } = await db.prepare(`WITH page AS (
   SELECT rowid AS cursor,* FROM ${schema(id)} WHERE rowid>? ORDER BY rowid LIMIT 32
  ), sized AS (
   SELECT *, SUM(length(CAST(sql AS BLOB))+320) OVER (ORDER BY cursor) AS bytes,
   MIN(cursor) OVER () AS first FROM page
  ) SELECT cursor,cursor<(SELECT MAX(rowid) FROM ${schema(id)}) AS more,name,sql,type,tbl_name,columns,dependencies,cursor-1 AS ordinal,
   CASE WHEN type='table' THEN (SELECT COUNT(*) FROM ${stored} WHERE ordinal=sized.cursor-1) END AS count
   FROM sized WHERE bytes<=? OR cursor=first ORDER BY cursor`)
  .bind(cursor, byteBudget).all<SchemaRow>();
 const entries = results.map(row => {
  if (row.type !== 'table') return { name: row.name, type: row.type, table: row.tbl_name, sql: row.sql };
  if (row.columns === null) throw new PortabilityError('archive_schema_changed', 409);
  return { ...tableMetadata(row), sql: row.sql, dependencies: (JSON.parse(row.dependencies) as string[]).sort(), count: row.count, ordinal: row.ordinal };
 });
 const last = results.at(-1);
 return Response.json({ entries, next: last?.more ? last.cursor : null });
}

async function dataPage(db: D1Database, id: string, tableCount: number, ordinal: number, cursor: number) {
 if (ordinal > tableCount) throw new PortabilityError('archive_table');
 const audit = ordinal === tableCount;
 const record = audit ? null : await db.prepare(`SELECT name,columns FROM ${schema(id)} WHERE rowid=? AND type='table'`)
  .bind(ordinal + 1).first<SchemaRow>();
 if (!audit && !record) throw new PortabilityError('archive_schema_changed', 409);
 const table = record && tableMetadata(record);
 const fields = table ? table.columns.map(column => column.name) : auditColumns;
 const slots = fields.map((_, i) => 'c' + i);
 const sizes = slots.map(slot => `COALESCE(length(CAST(${slot} AS BLOB)),0)`).join('+');
 const columnProjection = slots.map((slot, index) => `s.${slot} AS ${quote(fields[index])}`).join(',');
 const stored = copiedRows(id);
 const { results } = await db.prepare(`WITH page AS (
   SELECT cursor, ${sizes}+256 AS weight FROM ${stored} WHERE ordinal=?1 AND cursor>?2 ORDER BY cursor LIMIT 32
  ), sized AS (
   SELECT cursor,SUM(weight) OVER (ORDER BY cursor) AS bytes, MIN(cursor) OVER () AS first FROM page
  ), projected AS (
   SELECT s.cursor AS archive_cursor,CAST(s.source_rowid AS TEXT) AS archive_rowid,${columnProjection} FROM sized
   JOIN ${stored} s ON s.ordinal=?1 AND s.cursor=sized.cursor WHERE sized.bytes<=?3 OR sized.cursor=sized.first
  ) SELECT s.archive_cursor,s.archive_cursor<(SELECT MAX(cursor) FROM ${stored} WHERE ordinal=?1) AS archive_more,s.archive_rowid,${table ? projectedColumns(table, true) : auditColumns.map(quote).join(',')}
  FROM projected s ORDER BY s.archive_cursor`)
  .bind(ordinal, cursor, byteBudget).all<Record<string, unknown>>();
 const rows = results.map(({ archive_cursor: _, archive_more: more, archive_rowid: rowid, ...record }) => {
  if (!table) return projectAuditRow(record);
  if (table.name === 'rer_dependency_link') record.needs_relink = '1';
  const row = mapRow(policy, table, encodedRow(table, record, policy.secretColumns[table.name] ?? []));
  if (table.rowidAlias && !Number.isSafeInteger(Number(rowid))) throw new PortabilityError('unsafe_rowid');
  return { row, ...(table.rowidAlias ? { rowid: Number(rowid) } : {}) };
 });
 const last = results.at(-1);
 return Response.json({ rows, next: last?.archive_more ? last.archive_cursor : null });
}

function integer(query: URLSearchParams, key: string) {
 const value = query.get(key) ?? '0';
 if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new PortabilityError('archive_cursor');
 return Number(value);
}

export async function browserArchive(db: D1Database, session: OwnerSession, request: Request, query: URLSearchParams) {
 if (query.get('archive') === 'start') return start(db, session, request.signal);
 const id = query.get('id') ?? '';
 if (!jobId.test(id)) throw new PortabilityError('archive_id');
 const step = query.get('archive');
 const snapshot = await getSnapshot(db, id, session, step === 'capture');
 if (step === 'capture' && snapshot.phase === 'planning') return capture(db, session, id, JSON.parse(snapshot.metadata!) as Snapshot);
 if (step !== 'cancel' && snapshot.phase !== 'complete') throw new PortabilityError('archive_step', 409);
 switch (step) {
  case 'schema': return schemaPage(db, id, integer(query, 'after'));
  case 'rows': return dataPage(db, id, snapshot.tableCount, integer(query, 'table'), integer(query, 'after'));
  case 'finish':
  case 'cancel':
   await removeSnapshot(db, id, query.get('archive') === 'finish' ? 'succeeded' : 'uncertain');
   return new Response(null, { status: 204 });
  default: throw new PortabilityError('archive_step');
 }
}
