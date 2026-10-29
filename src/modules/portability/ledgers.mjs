import { all, insist } from './storage.mjs';
import { identifier } from './bookkeeping.mjs';
import { canonicalJson } from './hash.mjs';
import { validateRow } from './catalogue.mjs';

// Migration ledgers, by the runner that writes them: Base deploy and container
// runners (_rer_deploy_migrations), Wrangler and the Base deploy kit
// (d1_migrations, tracked or plain) and RER Platform (rer_migrations).
export const ledgerNames=['_rer_deploy_migrations','d1_migrations','rer_migrations'];
// Platform's ledger exactly as its runner creates it
// (platform src/integrations/cloudflare-migrations.ts:33).
const platformShape=canonicalJson([{name:'name',type:'TEXT',notnull:0,pk:1},{name:'sha256',type:'TEXT',notnull:1,pk:0},{name:'applied_at',type:'TEXT',notnull:1,pk:0}]);
const shape=columns=>canonicalJson(columns.map(({name,type,notnull,pk})=>({name,type,notnull,pk})));
// Platform records a file applied in part as <name>#<start>-<end> until the
// file completes (platform src/integrations/migration-batch.ts:31): its effects
// are uncertain, like a tracked ledger's 'applying' row.
const partial=name=>name.includes('#');

/** The destination's applied product migrations, [{name,sha256?}] in the ledger's own order, or undefined without a ledger. */
export async function destinationLedger(db) {
  return (await readLedger(db))?.entries;
}
/** The ledger table in use and its applied migrations, {table,entries}, or undefined without a ledger. */
export async function readLedger(db) {
  const found=(await all(db,`SELECT name FROM sqlite_master WHERE type='table' AND name IN (${ledgerNames.map(n=>`'${n}'`).join(',')})`)).map(x=>x.name);
  if(found.includes('_rer_deploy_migrations'))return {table:'_rer_deploy_migrations',entries:(await all(db,"SELECT * FROM _rer_deploy_migrations WHERE state='applied' ORDER BY name")).map(entry)};
  if(found.includes('d1_migrations')) {
    const columns=(await all(db,'PRAGMA table_info(d1_migrations)')).map(x=>x.name);
    insist(['id','name','applied_at'].every(name=>columns.includes(name)),'schema_mismatch:migration_history',409);
    const tracked=columns.includes('state') || columns.includes('sha256');
    if(tracked)insist(columns.includes('state') && columns.includes('sha256'),'schema_mismatch:migration_history',409);
    const rows=await all(db,`SELECT name${tracked?',state,sha256':''} FROM d1_migrations ORDER BY id`);
    insist(rows.every(row=>typeof row.name==='string') && new Set(rows.map(row=>row.name)).size===rows.length,'schema_mismatch:migration_history',409);
    if(tracked)insist(rows.every(row=>row.state==='applied'),'schema_mismatch:uncertain_migrations',409);
    if(tracked)insist(rows.every(row=>typeof row.sha256==='string' && /^[a-f0-9]{64}$/.test(row.sha256)),'schema_mismatch:migration_history',409);
    return {table:'d1_migrations',entries:rows.map(entry)};
  }
  if(!found.includes('rer_migrations'))return;
  // Platform applies pending files in its plan's order and inserts each ledger
  // row in the same request as the file's SQL (migration-batch.ts:35-38,43-64;
  // cloudflare-migrations.ts:34-44), so rowid order is application order.
  insist(shape(await all(db,'PRAGMA table_info(rer_migrations)'))===platformShape,'schema_mismatch:migration_history',409);
  const rows=await all(db,'SELECT name,sha256 FROM rer_migrations ORDER BY rowid');
  insist(rows.every(row=>typeof row.name==='string' && typeof row.sha256==='string' && /^[a-f0-9]{64}$/.test(row.sha256)) && new Set(rows.map(row=>row.name)).size===rows.length,'schema_mismatch:migration_history',409);
  insist(!rows.some(row=>partial(row.name)),'schema_mismatch:uncertain_migrations',409);
  return {table:'rer_migrations',entries:rows.map(entry)};
}
const entry=row=>({name:row.name,...(typeof row.sha256==='string'?{sha256:row.sha256}:{})});

// Resolve ledger identities against the destination's own migration files.
// Hash-bearing entries must identify exactly one file; a coinciding name may
// confirm that file, but cannot point at another one. Hashless rows use exact
// names or seed-declared aliases. The caller keeps the destination replay order.
export function matchMigrationLedger(entries,files,{dataOnly=[]}={}) {
  const matched=entries.flatMap(m=>{
    const named=files.filter(file=>file.name===m.name || file.aliases?.includes(m.name));
    insist(named.length<=1,'migration_ledger:ambiguous:'+m.name,409);
    if(m.sha256===undefined) {
      if(!named.length && dataOnly.includes(m.name))return [];
      insist(named.length,'migration_ledger:unknown:'+m.name,409);
      return [named[0].name];
    }
    const matches=files.filter(file=>file.sha256===m.sha256);
    if(!matches.length && !named.length && dataOnly.includes(m.name))return [];
    insist(matches.length,'migration_ledger:unknown:'+m.name,409);
    insist(matches.length===1,'migration_ledger:ambiguous:'+m.name,409);
    insist(!named.length || named[0]===matches[0],'migration_ledger:conflict:'+m.name,409);
    return [matches[0].name];
  });
  insist(new Set(matched).size===matched.length,'migration_ledger:ambiguous',409);
  return matched;
}

/**
 * What an export records when its source was migrated by RER Platform:
 * {origin:'rer_migrations',entries:[{name,sha256}]} in application order, each
 * entry named by the checkout file with that hash (the native identity) where
 * the exporter can read the checkout's files. Declared data-only entries and
 * hosted exporters, which have no files, keep the ledger's own names. Native
 * sources record nothing here, so their archives are unchanged.
 */
export async function platformOrigin(ledger,migrations) {
  if(ledger?.table!=='rer_migrations')return;
  const replay=await migrations?.();
  const files=replay?.names.map(name=>({name,sha256:replay.sha256?.(name),aliases:replay.aliases?.(name)}));
  const entries=ledger.entries.map(({name,sha256})=>({name:files?(matchMigrationLedger([{name,sha256}],files,replay)[0]??name):name,sha256}));
  insist(new Set(entries.map(entry=>entry.name)).size===entries.length,'migration_ledger:ambiguous',409);
  return {origin:'rer_migrations',entries};
}

/** The ledger tables an archive carries (old archives carried rer_migrations before it became bookkeeping). */
export const archivedLedgerTables=manifest=>manifest.tables.filter(t=>ledgerNames.includes(identifier(t.name)));

/** Collects the rows of an archive's ledger tables while its records are read: add(record) each, then ledgers() is {table:rows}, or undefined without one. */
export function ledgerReader() {
  let ledgers;
  return {
    add(record) {
      if(record.kind==='manifest') {const tables=archivedLedgerTables(record);if(tables.length)ledgers=Object.fromEntries(tables.map(t=>[t.name,[]]));}
      if(record.kind==='part' && ledgers)for(const item of record.items)if(item.kind==='row' && ledgers[item.table])ledgers[item.table].push(item.row);
    },
    ledgers:()=>ledgers,
  };
}
/** Checks rows a caller read from the archive for its ledger tables ({table:rows}), so uploadPart can bind each to the authenticated parts. */
export function checkArchivedLedgers(manifest,ledgers) {
  if(ledgers===undefined)return;
  const tables=archivedLedgerTables(manifest);
  insist(ledgers && typeof ledgers==='object' && Object.keys(ledgers).every(name=>tables.some(t=>t.name===name)),'ledger_inventory');
  for(const [name,rows] of Object.entries(ledgers)) {
    const table=tables.find(t=>t.name===name);
    insist(Array.isArray(rows) && rows.length===table.count,'ledger_inventory');
    for(const row of rows)validateRow(table,row,manifest.excludedColumns[name]??[]);
  }
}

/** The applied migrations an archive's own ledger records, [{name,sha256?}]; undefined when it carries no ledger. */
export function archivedHistory(manifest,ledgers,{allowOlderShape=false}={}) {
  const tables=archivedLedgerTables(manifest);
  // A Platform-origin export records its ledger in the manifest, never as a table.
  if(manifest.migrationLedger)insist(!tables.length,'schema_mismatch:migration_history');
  if(!tables.length)return manifest.migrationLedger?.entries.map(entry);
  insist(tables.length===1 && ledgers?.[tables[0].name],'schema_mismatch:migration_history');
  const [table]=tables,rows=ledgers[table.name],columns=table.columns.map(c=>c.name);
  if(identifier(table.name)==='rer_migrations') {
    const older=canonicalJson([{name:'name',type:'TEXT',notnull:0,pk:1},{name:'applied_at',type:'TEXT',notnull:1,pk:0}]);
    insist(shape(table.columns)===platformShape || (allowOlderShape && shape(table.columns)===older),'schema_mismatch:migration_history');
    insist(!rows.some(row=>partial(row.name)),'schema_mismatch:uncertain_migrations');
  }else{
    insist(columns.includes('name') && columns.includes('state')===columns.includes('sha256'),'schema_mismatch:migration_history');
    insist(rows.every(row=>row.state===undefined || row.state==='applied'),'schema_mismatch:uncertain_migrations');
  }
  insist(rows.every(row=>typeof row.name==='string') && new Set(rows.map(row=>row.name)).size===rows.length,'schema_mismatch:migration_history');
  return rows.map(entry);
}
