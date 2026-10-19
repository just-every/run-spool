import { all, quote, insist } from './storage.mjs';
import { canonicalJson } from './hash.mjs';
import { tokens, identifier, folded } from './generated.mjs';
import { laterData } from './backfills.mjs';
import { destinationLedger } from './ledgers.mjs';

// Applied product migrations in the ledger's own order (ledgers.mjs). A
// state-bearing ledger may hold an unacknowledged migration whose effects are
// unknown; neither an archive nor a restore can attest its history until that
// is resolved.
export async function appliedMigrations(db) {
  return (await destinationLedger(db))?.map(m=>m.name);
}
// Where an archive sits in the destination's applied migrations: those its
// rows passed through (earlier) and those applied after it (unapplied).
// migrations() is the runner's replay of the destination's applied migrations
// (migration-history.mjs). The archive's schema must be the replay of the
// migrations it records or, for archives that predate that record, of those
// its own migration ledger records or, without one, of an earlier prefix.
// Restored rows never pass through a later migration, so one that writes or
// rewrites restorable data is refused, whether or not it changes the schema,
// unless its statement is replayed at finalize (backfills.mjs).
async function placement(db,manifest,cat,replay,ledger,history) {
  const applied=ledger.map(m=>m.name);
  insist(canonicalJson(replay.names)===canonicalJson(applied) && await replay.schemaAfter(applied)===cat.identity,'schema_mismatch');
  const recorded=manifest.migrations ?? archivedApplied(history?.(),ledger,replay);
  let earlier,unapplied;
  if(recorded) {
    earlier=applied.filter(name=>recorded.includes(name));
    insist(await replay.schemaAfter(earlier)===manifest.schema,'schema_mismatch');
    unapplied=applied.filter(name=>!earlier.includes(name));
  }else{
    // Unrecorded: the latest matching prefix. Migrations that change no archived
    // table (indexes, excluded tables, data-only changes) cannot be told apart
    // and count as later. The source may have stopped at any matching prefix,
    // so every migration after the earliest one may be missing from its rows.
    const matching=[];
    for(let k=0;k<=applied.length;k++)if(await replay.schemaAfter(applied.slice(0,k))===manifest.schema)matching.push(k);
    insist(matching.length,'schema_mismatch');
    earlier=applied.slice(0,matching.at(-1));
    unapplied=applied.slice(matching[0]);
  }
  // Only rows the archive carries can skip a later migration's change. A table
  // the archive does not hold is restored empty, so backfills that name only
  // such tables (a newly added module's own) change no restored row, unless a
  // trigger from any applied migration carries their writes into one that is
  // restorable. Trigger DDL itself changes no row, nor does an UPDATE or DELETE
  // of a table the archive holds no rows of (migration-statements.mjs). A data
  // statement that writes only tables outside the catalogue is admitted
  // whatever it reads; a backfill of a table the archive lacks is replayed.
  const catalogue=cat.tables.map(t=>t.name),archived=catalogue.filter(name=>manifest.tables.some(t=>t.name===name));
  const empty=archived.filter(name=>!manifest.tables.find(t=>t.name===name).count);
  const tables=(await all(db,"SELECT name FROM sqlite_master WHERE type IN ('table','view')")).map(t=>t.name);
  const replays=laterData({applied,unapplied,replay,catalogue,archived,empty,tables,secrets:manifest.excludedColumns??{}});
  return {earlier,replays};
}
// An archive without a migration record that carries its source's migration
// ledger (an old archive from before that ledger became bookkeeping) records
// exactly which migrations its rows passed through. Each must be one the
// destination applied, with the same file hash where the ledger records one:
// the destination ledger's, else the replayed file's. The ledger itself is
// never restored (bookkeeping.mjs). history: [{name,sha256?}] from
// ledgers.mjs archivedHistory, undefined when the archive carries no ledger.
function archivedApplied(history,ledger,replay) {
  for(const m of history??[]) {
    const applied=ledger.find(x=>x.name===m.name);
    insist(applied && (m.sha256===undefined || m.sha256===(applied.sha256??replay.sha256?.(m.name))),'schema_mismatch:migration_history:'+m.name);
  }
  return history?.map(m=>m.name);
}
// An archive with the destination's schema identity can still predate later
// migrations that changed only data (a purge or a backfill) or added an index.
// Those that change restorable data are refused like any other. Without a
// replayer the statements cannot be read, so an archive whose recorded
// migrations the destination's ledger has outgrown is refused. An archive that
// records a migration the destination never applied is newer than it, even
// when that migration left the schema as it was (an index, a data change).
export async function sameSchemaMigrations(db,manifest,cat,migrations,history) {
  const ledger=await destinationLedger(db),applied=ledger?.map(m=>m.name);
  if(!applied)return;
  insist(!manifest.migrations || manifest.migrations.every(name=>applied.includes(name)),'schema_mismatch:migrations');
  if(!migrations){insist(!manifest.migrations || applied.every(name=>manifest.migrations.includes(name)),'schema_mismatch:migrations');return;}
  // Same schema: every catalogue table is archived, so nothing is replayed.
  await placement(db,manifest,cat,await migrations(),ledger,history);
}
// An archive made before later migrations restores only when those migrations
// are additive: new tables, new columns that take a default, or indexes (which
// archives never carry). Anything else stays a schema_mismatch refusal.
export async function additiveBridge(db,manifest,cat,migrations,history) {
  insist(migrations,'schema_mismatch');
  const replay=await migrations(),ledger=await destinationLedger(db)??[],applied=ledger.map(m=>m.name);
  insist(!manifest.migrations || manifest.migrations.every(name=>applied.includes(name)),'schema_mismatch:migrations');
  const {earlier,replays}=await placement(db,manifest,cat,replay,ledger,history);
  const columns={};
  for(const table of manifest.tables) {
    const target=cat.tables.find(t=>t.name===table.name),label=':'+table.name;
    insist(target,'schema_mismatch:table'+label);
    const kept=target.columns.slice(0,table.columns.length),added=target.columns.slice(table.columns.length);
    insist(canonicalJson(kept)===canonicalJson(table.columns) && table.rowidAlias===target.rowidAlias && table.dependencies.every(d=>target.dependencies.includes(d)),'schema_mismatch:columns'+label);
    if(!added.length){insist(table.sql===target.sql,'schema_mismatch:definition'+label);continue;}
    const declared=await all(db,`PRAGMA table_xinfo(${quote(table.name)})`);
    insist(added.every(c=>!c.pk && !c.generated && (!c.notnull || declared.find(d=>d.name===c.name)?.dflt_value!=null)),'schema_mismatch:column_default'+label);
    insist(appended(table.sql,target.sql,added.map(c=>c.name)),'schema_mismatch:definition'+label);
    columns[table.name]=added.map(c=>c.name);
  }
  // replays: the statements finalize runs (backfills.mjs); replayed: the job's record of them.
  return {fromSchema:manifest.schema,toSchema:cat.identity,migrations:applied.filter(name=>!earlier.includes(name)),
    tables:cat.tables.filter(t=>!manifest.tables.some(x=>x.name===t.name)).map(t=>t.name),columns,
    ...(replays.length?{replays,replayed:replays.map(({migration,statement,table})=>({migration,statement,table,rows:null}))}:{})};
}
// The destination definition is the archived one with only the added column
// definitions inserted, as ALTER TABLE ADD COLUMN writes it: no other column,
// constraint or table option may differ.
function appended(before,after,names) {
  const a=tokens(before).map(t=>t.text),b=tokens(after),text=b.map(t=>t.text);
  let prefix=0,suffix=0;
  while(prefix<a.length && a[prefix]===text[prefix])prefix++;
  while(suffix<a.length && a[a.length-1-suffix]===text[text.length-1-suffix])suffix++;
  for(let k=Math.max(0,a.length-suffix);k<=prefix;k++) {
    const run=b.slice(k,k+text.length-a.length);
    if(run[0]?.text===',' && definitions(run.slice(1),names))return true;
  }
  return false;
}
function definitions(run,names) {
  const parts=[[]];let depth=0;
  for(const token of run) {
    if(token.text==='(')depth++;
    if(token.text===')' && --depth<0)return false;
    if(token.text===',' && !depth)parts.push([]);else parts.at(-1).push(token);
  }
  return !depth && parts.length===names.length && parts.every((part,i)=>part.length && folded(identifier(part[0]))===folded(names[i]));
}
