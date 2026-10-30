import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {readArchive} from '../src/modules/portability/index.mjs';
import {platformTable} from '../src/modules/portability/bookkeeping.mjs';
import {policy} from '../src/modules/portability/catalogue.mjs';
// TEAM-004 stores (migration 0059) and SRC-003's release/deploy stores (migration 0060) that the released schema lacks.
const membershipTables = ['spool_reporting_items','spool_reporting_projects','spool_reporting_widgets','spool_reporting_shares','spool_team_digest_settings','spool_team_snoozes','spool_team_mail','spool_organizations','spool_members','spool_project_teams','spool_project_grants','spool_member_invites','spool_service_accounts','spool_service_scopes'];
const personalTables = ['spool_notification_preferences','spool_personal_mail','spool_personal_rule_settings','spool_personal_digest_settings','spool_issue_follows'];
const citationTables = [...personalTables,'issue_recurrence_boundaries','issue_priorities','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions',...membershipTables,'review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates','slack_delivery_meta','suspect_decisions','source_map_builds','source_map_build_files','artifact_storage_settings','loader_settings','short_id_prefixes','issue_short_ids','issue_short_id_moves','commits','release_commits','commit_links','repository_link_log','commit_sharing','sentry_releases','sentry_deploys'];

// This is the unchanged output of the old native exporter, including its ledger.
const archive = await readFile('tests/fixtures/archive-fc75a7ac.ndjson', 'utf8');
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
let runtime, worker;
const rows = async (db, sql) => (await db.prepare(sql).all()).results;
const canonicalRows = data => data.map(row => JSON.stringify(Object.fromEntries(Object.entries(row).sort()))).sort();
try {
 const modulePath = resolve(temporary, 'portability.mjs');
 await build({entryPoints: ['src/domain/portability.ts'], outfile: modulePath, bundle: true, platform: 'node', format: 'esm'});
 const transfer = await import(pathToFileURL(modulePath));
 runtime = new Miniflare(convertV4MiniflareOptions({modules: true, script: 'export default {}', log: new Log(LogLevel.ERROR), d1Databases: {FRESH: 'fresh', OCCUPIED: 'occupied', MISMATCH: 'mismatch', ROUNDTRIP: 'roundtrip', UPGRADE: 'upgrade', CURRENT_UPGRADE: 'current-upgrade'}}));
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
 // An existing capture key predates the loader migration; migrations preserve it too.
 const existingProject = (await rows(upgrade, 'SELECT id FROM projects ORDER BY created,id'))[0].id;
 await upgrade.prepare("INSERT INTO credentials(hash,project,kind,created,revoked) VALUES(?,?,'ingest',1,NULL)").bind('a'.repeat(64), existingProject).run();
 const oldTables = await rows(upgrade, "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name");
 const beforeUpgrade = new Map(await Promise.all(oldTables.map(async ({name}) => [name, canonicalRows(await rows(upgrade, `SELECT * FROM "${name}"`))])));
 const added = migrations.filter(migration => !released.some(old => old.name === migration.name));
 assert.ok(added.length, 'the test applies the unreleased migration to the populated release');
 const additions = unstable_splitSqlQuery(added.map(migration => migration.sql).join('\n')).filter(sql => !/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim()));
 await upgrade.batch(additions.map(sql => upgrade.prepare(sql)));
 for (const {name,sql} of oldTables) {
  assert.deepEqual(canonicalRows(await rows(upgrade, `SELECT * FROM "${name}"`)), beforeUpgrade.get(name), `populated upgrade preserves every pre-existing row: ${name}`);
  if(name!=='spool_audit_events') {
   let actual=(await upgrade.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(name).first()).sql;
   if(name==='alert_mail_jobs') {
    const columns=await rows(upgrade,'PRAGMA table_info(alert_mail_jobs)');
    const personal=columns.filter(column=>column.name.startsWith('personal_'));
    assert.equal(personal.length,3);
    assert.ok(personal.every(column=>column.notnull===0&&column.dflt_value===null&&column.pk===0),'old queued mail gains no inferred personal authority');
    actual=actual.replace(/, personal_operator TEXT, personal_member_version INTEGER, personal_operator_version INTEGER\)$/,')');
   }
   assert.equal(actual, sql, `populated upgrade preserves released table schema: ${name}`);
  }
 }
 for(const table of ['review_stamps','review_views','retention_policies','identity_policies','event_identities','project_identity_keys','health_sessions','health_aggregates'])assert.deepEqual(await rows(upgrade, 'SELECT * FROM '+table), [], 'populated upgrade invents no observed sessions or identity key');
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM slack_destinations'), [], 'populated upgrade connects no Slack destination');
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM slack_delivery_meta'), [], 'populated upgrade invents no Slack acknowledgment');
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM suspect_decisions'), [], 'populated upgrade invents no suspect judgment');
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM grouping_proposals'), []);
 for(const table of [...personalTables,'spool_personal_unsubscribe'])assert.deepEqual(await rows(upgrade, 'SELECT * FROM '+table), [], 'a populated upgrade never invents personal opt-ins or delivery authority: '+table);
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM checkin_routes'), [], 'existing projects start with cron check-in forwarding off');
 assert.deepEqual(await rows(upgrade, 'SELECT * FROM loader_settings'), [], 'existing capture keys start with lazy, optional-capture-off defaults');
 assert.equal((await upgrade.prepare("SELECT COUNT(*) n FROM credentials WHERE project=? AND kind='ingest' AND revoked IS NULL").bind(existingProject).first()).n, 1, 'the populated upgrade keeps the active capture key');
 // TEAM-004: migration 0059 gives every existing issue a short ID in first-seen order, per project prefix.
 const upgradedIds = await rows(upgrade, 'SELECT * FROM issue_short_ids ORDER BY project,number');
 assert.ok(upgradedIds.length > 0 && upgradedIds.length === (await rows(upgrade, 'SELECT id FROM issues')).length && upgradedIds.every(row => row.issue === row.assigned), 'every upgraded issue has its own short ID');
 assert.deepEqual((await rows(upgrade, 'SELECT project FROM short_id_prefixes ORDER BY project')).map(row => row.project), (await rows(upgrade, 'SELECT id FROM projects ORDER BY id')).map(row => row.id));
 console.log('PASS populated published release upgrades without rewriting any pre-existing row or table: '+oldTables.length+' tables, '+[...beforeUpgrade.values()].reduce((count,rows)=>count+rows.length,0)+' rows before and after');

 // c17: apply only 0069 onward to a populated installation at current main's 0068.
 const at0068 = migrations.filter(m => m.name <= '0068_artifact_build_sets.sql');
 const currentUpgrade = await target('CURRENT_UPGRADE', at0068);
 const newTables = [...personalTables,'issue_recurrence_boundaries','issue_priorities','issue_activity','issue_comments','issue_subscriptions','recurrence_policies','issue_suppressions',...membershipTables,'retention_runs','checkin_routes','checkin_links','suspect_decisions','slack_destinations','slack_delivery_meta','project_identity_keys','health_sessions','health_aggregates','review_stamps','review_views','retention_policies','identity_policies','event_identities'];
 transfer.portabilityPolicy.validateStaged = context => stagedValidation({...context, read: table => newTables.includes(table) ? Promise.resolve([]) : context.read(table)});
 try { await transfer.restoreArchive(await transfer.portability(currentUpgrade), new Response(archive).body); }
 finally { transfer.portabilityPolicy.validateStaged = stagedValidation; }
 const currentTables = await rows(currentUpgrade, "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name");
 const currentRows = new Map(await Promise.all(currentTables.map(async ({name}) => [name, canonicalRows(await rows(currentUpgrade, `SELECT * FROM "${name}"`))])));
 assert.ok(currentRows.get('projects').length && currentRows.get('events').length, '0068 installation has populated evidence');
 const from0068 = migrations.filter(m => m.name > '0068_artifact_build_sets.sql' && m.name <= '0073_identity_policy.sql');
 assert.equal(from0068.length, 5, 'all five c15 additive migrations follow 0068');
 await currentUpgrade.batch(unstable_splitSqlQuery(from0068.map(m => m.sql).join('\n')).filter(sql => !/^PRAGMA foreign_keys\s*=\s*ON;?$/i.test(sql.trim())).map(sql => currentUpgrade.prepare(sql)));
 for (const {name,sql} of currentTables) {
  assert.deepEqual(canonicalRows(await rows(currentUpgrade, `SELECT * FROM "${name}"`)), currentRows.get(name), `0068 upgrade preserves every row: ${name}`);
  assert.equal((await currentUpgrade.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").bind(name).first()).sql, sql, `0068 upgrade preserves schema: ${name}`);
 }
 console.log('PASS populated 0068 upgrade: ' + currentTables.length + ' tables preserved; five additive migrations applied');

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

 // Qualification against an independent current-main checkout: do not synthesize
 // an older manifest from the candidate exporter or erase either migration ledger.
 if(process.env.SPOOL_MAIN_ROOT) {
  const candidateRoot=process.cwd(),sourceRoot=resolve(process.env.SPOOL_MAIN_ROOT);
  const migrationFiles=async root=>Promise.all((await readdir(resolve(root,'migrations/core'))).filter(name=>name.endsWith('.sql')).sort().map(async name=>{
   const sql=await readFile(resolve(root,'migrations/core',name),'utf8');
   return {name,sql,sha256:createHash('sha256').update(sql).digest('hex')};
  }));
  const sourceMigrations=await migrationFiles(sourceRoot);
  await runtime.dispose();runtime=undefined;
  const {startTestWorker}=await import('./worker.mjs'),{signIn}=await import('./auth.mjs');
  let mainArchive;
  try {
   process.chdir(sourceRoot);
   const {startTestWorker:mainWorker}=await import(pathToFileURL(resolve(sourceRoot,'tests/worker.mjs')));
   worker=await mainWorker(15788);
   const source=await worker.db(),cookie=await signIn(worker.origin);
   await source.prepare(ledgerTable.sql).run();
   await source.batch(sourceMigrations.map(m=>source.prepare('INSERT INTO rer_migrations(name,sha256) VALUES(?,?)').bind(m.name,m.sha256)));
   const baseline=await fetch(worker.origin+'/api/restore',{method:'POST',headers:{Origin:worker.origin,Cookie:cookie,'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'},body:archive});
   assert.equal(baseline.status,200,await baseline.text());
   const exported=await fetch(worker.origin+'/api/archive',{headers:{Cookie:cookie}});
   assert.equal(exported.status,200);mainArchive=await exported.text();
  } finally {await worker?.stop();worker=undefined;process.chdir(candidateRoot);}
  const mainRecords=[];for await(const record of readArchive(new Response(mainArchive).body))mainRecords.push(record);
  assert.deepEqual(mainRecords[0].migrations,sourceMigrations.map(m=>m.name),'genuine main export carries its complete applied ledger');
  const mainRows=Object.fromEntries(mainRecords[0].tables.map(table=>[table.name,[]]));
  for(const part of mainRecords.filter(record=>record.kind==='part'))for(const item of part.items)if(item.kind==='row')mainRows[item.table].push(item.row);
  assert.ok(mainRows.projects.length&&mainRows.events.length,'main archive contains populated evidence');
  worker=await startTestWorker(15789);
  const destination=await worker.db(),destinationMigrations=await migrationFiles(process.cwd());
  await destination.prepare(ledgerTable.sql).run();
  await destination.batch(destinationMigrations.map(m=>destination.prepare('INSERT INTO rer_migrations(name,sha256) VALUES(?,?)').bind(m.name,m.sha256)));
  const beforeLedger=await rows(destination,'SELECT * FROM rer_migrations ORDER BY name');
  const cookie=await signIn(worker.origin);
  const restored=await fetch(worker.origin+'/api/restore',{method:'POST',headers:{Origin:worker.origin,Cookie:cookie,'Content-Type':'application/x-ndjson','x-confirm-restore':'yes'},body:mainArchive});
  const restoredBody=await restored.text();
  assert.equal(restored.status,200,'genuine current-main archive restores through HTTP with every destination migration recorded: '+restoredBody);
  for(const [table,data] of Object.entries(mainRows))assert.deepEqual(canonicalRows(await rows(destination,`SELECT * FROM "${table}"`)),canonicalRows(data),'HTTP restore retains main evidence: '+table);
  for(const table of personalTables)assert.deepEqual(await rows(destination,'SELECT * FROM '+table),[],'HTTP restore invents no personal authority: '+table);
  assert.deepEqual(await rows(destination,'SELECT * FROM rer_migrations ORDER BY name'),beforeLedger,'HTTP restore retains the complete destination ledger');
  console.log('PROBE TEAM-005 A1: main GET /api/archive ('+sourceMigrations.length+' migrations) -> candidate POST /api/restore HTTP '+restored.status+' '+restoredBody+'; complete destination migrations='+JSON.stringify(beforeLedger.map(row=>row.name)));
 }
} finally {
 try { await worker?.stop(); } finally {
  try { await runtime?.dispose(); } finally { await rm(temporary, {recursive: true, force: true}); }
 }
}
