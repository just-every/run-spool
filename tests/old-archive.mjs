import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {readArchive} from '../src/modules/portability/index.mjs';
import {platformTable} from '../src/modules/portability/bookkeeping.mjs';
import {policy} from '../src/modules/portability/catalogue.mjs';
// TEAM-004 stores (migration 0059) and SRC-003's release/deploy stores (migration 0060) that the released schema lacks.
const citationTables = ['short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing','sentry_releases','sentry_deploys'];

// This is the unchanged output of the old native exporter, including its ledger.
const archive = await readFile('tests/fixtures/archive-fc75a7ac.rer', 'utf8');
const records = [];
for await (const record of readArchive(new Response(archive).body)) records.push(record);
const manifest = records[0];
const expected = Object.fromEntries(manifest.tables.filter(t => !platformTable(t.name)).map(t => [t.name, []]));
for (const part of records.filter(r => r.kind === 'part')) for (const item of part.items) {
 if (item.kind === 'row' && !platformTable(item.table)) expected[item.table].push(item.row);
}
const require = createRequire(import.meta.url);
const {Miniflare, convertV4MiniflareOptions, Log, LogLevel} = require(require.resolve('miniflare', {paths: [require.resolve('wrangler/package.json')]}));
const {unstable_splitSqlQuery} = require('wrangler');
const migrations = JSON.parse(await readFile('management/integration/deployment-spec.json', 'utf8')).migrations;
// Published tag bytes, fetched independently of this checkout's history.
const released = JSON.parse(await readFile('tests/fixtures/deployment-spec-v0.6.0.json', 'utf8')).migrations;
const temporary = await mkdtemp(resolve(tmpdir(), 'spool-old-archive-'));
let runtime;
const rows = async (db, sql) => (await db.prepare(sql).all()).results;
const canonicalRows = data => data.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort();
try {
 const modulePath = resolve(temporary, 'portability.mjs');
 await build({entryPoints: ['src/domain/portability.ts'], outfile: modulePath, bundle: true, platform: 'node', format: 'esm'});
 const transfer = await import(pathToFileURL(modulePath));
 runtime = new Miniflare(convertV4MiniflareOptions({modules: true, script: 'export default {}', log: new Log(LogLevel.ERROR), d1Databases: {FRESH: 'fresh', OCCUPIED: 'occupied', MISMATCH: 'mismatch', ROUNDTRIP: 'roundtrip', UPGRADE: 'upgrade'}}));
 const ledgerTable = manifest.tables.find(t => t.name === 'rer_migrations');
 async function target(binding, schema = migrations) {
  const db = await runtime.getD1Database(binding);
  const statements = unstable_splitSqlQuery(schema.map(m => m.sql).join('\n')).filter(sql => !/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
  await db.batch(statements.map(sql => db.prepare(sql)));
  await db.prepare(ledgerTable.sql).run();
  await db.batch(schema.map(m => db.prepare('INSERT INTO rer_migrations(name,sha256) VALUES(?,?)').bind(m.name, m.sha256)));
  return db;
 }
 // Populate the actual released schema through the existing archive door,
 // before the additive proposal/delivery migrations exist. The harness adapter
 // supplies empty collections only for tables absent from that released schema.
 const upgrade = await target('UPGRADE', released);
 const stagedValidation = transfer.portabilityPolicy.validateStaged;
 transfer.portabilityPolicy.validateStaged = context => stagedValidation({...context, read: table => ['grouping_proposals','alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail',...citationTables].includes(table) ? Promise.resolve([]) : context.read(table)});
 // The released restore had no short-ID numbering step; its schema has no short-ID tables.
 try { await transfer.restoreArchive(await transfer.portability(upgrade), new Response(archive).body); }
 finally { transfer.portabilityPolicy.validateStaged = stagedValidation; }
 for (const [table, data] of Object.entries(expected)) assert.deepEqual(canonicalRows(await rows(upgrade, `SELECT * FROM "${table}"`)), canonicalRows(data), `released baseline is populated through restore: ${table}`);
 const oldTables = await rows(upgrade, "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name");
 const beforeUpgrade = new Map(await Promise.all(oldTables.map(async ({name}) => [name, canonicalRows(await rows(upgrade, `SELECT * FROM "${name}"`))])));
 const added = migrations.filter(migration => !released.some(old => old.name === migration.name));
 assert.ok(added.length, 'the test applies the unreleased migration to the populated release');
 const additions = unstable_splitSqlQuery(added.map(migration => migration.sql).join('\n')).filter(sql => !/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
 await upgrade.batch(additions.map(sql => upgrade.prepare(sql)));
 for (const {name,sql} of oldTables) {
  assert.deepEqual(canonicalRows(await rows(upgrade, `SELECT * FROM "${name}"`)), beforeUpgrade.get(name), `populated upgrade preserves every pre-existing row: ${name}`);
  assert.equal((await upgrade.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(name).first()).sql, sql, `populated upgrade preserves released table schema: ${name}`);
 }
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM grouping_proposals'), []);
 // TEAM-004: migration 0059 gives every existing issue a short ID in first-seen order, per project prefix.
 const upgradedIds = await rows(upgrade, 'SELECT * FROM issue_short_ids ORDER BY project,number');
 assert.ok(upgradedIds.length > 0 && upgradedIds.length === (await rows(upgrade, 'SELECT id FROM issues')).length && upgradedIds.every(row => row.issue === row.assigned), 'every upgraded issue has its own short ID');
 assert.deepEqual((await rows(upgrade, 'SELECT project FROM short_id_prefixes ORDER BY project')).map(row => row.project), (await rows(upgrade, 'SELECT id FROM projects ORDER BY id')).map(row => row.id));
 console.log('PASS populated published release upgrades without rewriting any pre-existing row or table: '+oldTables.length+' tables, '+[...beforeUpgrade.values()].reduce((count,rows)=>count+rows.length,0)+' rows before and after');

 const fresh = await target('FRESH');
 const ledger = await rows(fresh, 'SELECT * FROM rer_migrations ORDER BY name');
 await transfer.restoreStream(await transfer.portability(fresh), new Response(archive).body);
 for (const [table, data] of Object.entries(expected)) assert.deepEqual(canonicalRows(await rows(fresh, `SELECT * FROM "${table}"`)), canonicalRows(data), `old archive retains every row in ${table}`);
 for (const table of ['release_metadata', 'release_builds', 'release_policies', 'issue_resolutions', 'grouping_proposals']) assert.deepEqual(await rows(fresh, `SELECT * FROM "${table}"`), []);
 // TEAM-004: restore numbers the old archive's issues exactly as the migration numbered its upgraded source.
 for (const table of ['short_id_prefixes', 'issue_short_ids']) assert.deepEqual(await rows(fresh, `SELECT * FROM ${table} ORDER BY 1`), await rows(upgrade, `SELECT * FROM ${table} ORDER BY 1`), `restore and upgrade agree on ${table}`);
 assert.deepEqual(await rows(fresh, 'SELECT * FROM rer_migrations ORDER BY name'), ledger, 'destination migration ledger remains intact');
 assert.deepEqual(await rows(fresh, "SELECT phase FROM rer_portability_jobs WHERE kind='import'"), [{phase: 'complete'}]);
 // AUDIT-001: a previous format carries no safe history; any restored journal row gains one value-free legacy
 // fact at its own time (tests/audit-history.mjs restores one with rows). The local restore is a service fact.
 const journal = await rows(fresh, 'SELECT detail,created FROM audit ORDER BY created,id'), legacy = await rows(fresh, "SELECT * FROM spool_audit_events WHERE source='legacy' ORDER BY sequence");
 assert.deepEqual(legacy.map(row => row.created), journal.map(row => row.created), 'AUDIT-001 restored journal chronology is kept, never rewritten');
 assert.ok(legacy.every(row => row.actor_kind === 'unknown' && row.outcome === 'succeeded'));
 for (const value of journal.flatMap(row => Object.values(JSON.parse(row.detail))).filter(value => typeof value === 'string' && value.length > 3)) assert.ok(!JSON.stringify(legacy).includes(value), 'AUDIT-001 legacy facts hold no journal value');
 assert.deepEqual(await rows(fresh, "SELECT actor_kind,action FROM spool_audit_events WHERE source<>'legacy'"), [{actor_kind: 'service', action: 'archive.restore'}]);
 assert.deepEqual(await rows(fresh, 'SELECT * FROM audit_restore_staging'), []);
 console.log('PASS old native archive restores into a fresh migrated target with all product rows and destination ledger intact');

 const occupied = await target('OCCUPIED');
 await occupied.prepare("INSERT INTO projects VALUES('occupied','Existing project',100)").run();
 await assert.rejects(transfer.restoreStream(await transfer.portability(occupied), new Response(archive).body), error => error.code === 'target_not_empty:projects');
 assert.deepEqual(await rows(occupied, 'SELECT id,name FROM projects'), [{id: 'occupied', name: 'Existing project'}]);
 console.log('PASS old archive refuses an occupied target without changing its project');

 const mismatch = await target('MISMATCH');
 await mismatch.prepare('ALTER TABLE projects ADD COLUMN incompatible TEXT').run();
 await assert.rejects(transfer.restoreStream(await transfer.portability(mismatch), new Response(archive).body), error => error.code === 'schema_mismatch');
 assert.deepEqual(await rows(mismatch, 'SELECT * FROM projects'), []);
 // Even after adaptation, readArchive must verify the original closing binding.
 const corrupt = records.map(record => record.kind === 'closing' ? {...record, archiveHash: '0'.repeat(64)} : record).map(record => JSON.stringify(record)).join('\n') + '\n';
 const roundtrip = await target('ROUNDTRIP');
 await assert.rejects(transfer.restoreStream(await transfer.portability(roundtrip), new Response(corrupt).body), error => error.code === 'archive_checksum');
 assert.deepEqual(await rows(roundtrip, 'SELECT * FROM projects'), []);
 console.log('PASS genuinely mismatched schema and corrupted original archive binding still refuse');

 const current = await new Response(await transfer.archiveStream(await transfer.portability(fresh))).text();
 await transfer.restoreStream(await transfer.portability(roundtrip), new Response(current).body);
 for (const [table, data] of Object.entries(expected)) assert.deepEqual(canonicalRows(await rows(roundtrip, `SELECT * FROM "${table}"`)), canonicalRows(data));
 for (const name of Object.keys(expected)) assert.equal(platformTable(name), false);
 for (const name of ['projects', 'releases', 'issues', 'events', 'artifacts', 'audit', 'alerts', 'alert_destinations', 'alert_mail_jobs', 'feedback', 'grouping_policies', 'grouping_proposals', 'repairs', 'repair_checks', 'rer_erasure_operations', 'rer_dependency_installation', 'rer_dependency_link']) assert.equal(platformTable(name), false, `${name} is person-owned`);
 assert.throws(() => policy({...transfer.portabilityPolicy, includeTables: ['rer_migrations']}));
 console.log('PASS current archive independently restores and mandatory bookkeeping exclusions retain person-owned tables');
} finally {
 try { await runtime?.dispose(); } finally { await rm(temporary, {recursive: true, force: true}); }
}
