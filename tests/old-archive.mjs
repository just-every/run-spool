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
const temporary = await mkdtemp(resolve(tmpdir(), 'spool-old-archive-'));
let runtime;
const rows = async (db, sql) => (await db.prepare(sql).all()).results;
const canonicalRows = data => data.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort();
try {
 const modulePath = resolve(temporary, 'portability.mjs');
 await build({entryPoints: ['src/domain/portability.ts'], outfile: modulePath, bundle: true, platform: 'node', format: 'esm'});
 const transfer = await import(pathToFileURL(modulePath));
 runtime = new Miniflare(convertV4MiniflareOptions({modules: true, script: 'export default {}', log: new Log(LogLevel.ERROR), d1Databases: {FRESH: 'fresh', OCCUPIED: 'occupied', MISMATCH: 'mismatch', ROUNDTRIP: 'roundtrip'}}));
 const ledgerTable = manifest.tables.find(t => t.name === 'rer_migrations');
 async function target(binding) {
  const db = await runtime.getD1Database(binding);
  const statements = unstable_splitSqlQuery(migrations.map(m => m.sql).join('\n')).filter(sql => !/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
  await db.batch(statements.map(sql => db.prepare(sql)));
  await db.prepare(ledgerTable.sql).run();
  await db.batch(migrations.map(m => db.prepare('INSERT INTO rer_migrations(name,sha256) VALUES(?,?)').bind(m.name, m.sha256)));
  return db;
 }
 const fresh = await target('FRESH');
 const ledger = await rows(fresh, 'SELECT * FROM rer_migrations ORDER BY name');
 await transfer.restoreStream(await transfer.portability(fresh), new Response(archive).body);
 for (const [table, data] of Object.entries(expected)) assert.deepEqual(canonicalRows(await rows(fresh, `SELECT * FROM "${table}"`)), canonicalRows(data), `old archive retains every row in ${table}`);
 for (const table of ['release_metadata', 'release_builds', 'release_policies', 'issue_resolutions']) assert.deepEqual(await rows(fresh, `SELECT * FROM "${table}"`), []);
 assert.deepEqual(await rows(fresh, 'SELECT * FROM rer_migrations ORDER BY name'), ledger, 'destination migration ledger remains intact');
 assert.deepEqual(await rows(fresh, "SELECT phase FROM rer_portability_jobs WHERE kind='import'"), [{phase: 'complete'}]);
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
 for (const name of ['projects', 'releases', 'issues', 'events', 'artifacts', 'audit', 'alerts', 'alert_destinations', 'alert_mail_jobs', 'feedback', 'grouping_policies', 'repairs', 'repair_checks', 'rer_erasure_operations', 'rer_dependency_installation', 'rer_dependency_link']) assert.equal(platformTable(name), false, `${name} is person-owned`);
 assert.throws(() => policy({...transfer.portabilityPolicy, includeTables: ['rer_migrations']}));
 console.log('PASS current archive independently restores and mandatory bookkeeping exclusions retain person-owned tables');
} finally {
 try { await runtime?.dispose(); } finally { await rm(temporary, {recursive: true, force: true}); }
}
