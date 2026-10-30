import { all, quote, insist } from './storage.mjs';
import { canonicalJson } from './hash.mjs';
import { tokens, identifier, folded } from './generated.mjs';
import { laterData } from './backfills.mjs';
import { destinationLedger, matchMigrationLedger } from './ledgers.mjs';
import { checkRebuild } from './rebuilds.mjs';
import { schemaSQL } from './schema-identity.mjs';

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
async function placement(db,manifest,cat,replay,ledger,history,legacyRecovery,unverified=false) {
  const files=replay.names.map(name=>({name,sha256:replay.sha256?.(name),aliases:replay.aliases?.(name)}));
  // An aligned replayer keeps its existing contract: hashes are optional.
  // Resolve destination aliases only when its ledger uses different names.
  let applied=ledger.map(m=>m.name);
  if(canonicalJson(replay.names)!==canonicalJson(applied))applied=matchMigrationLedger(ledger,files,replay);
  insist(canonicalJson(replay.names)===canonicalJson(applied) && await replay.schemaAfter(applied)===cat.identity,'schema_mismatch');
  const archived=history?.();
  const historyEntries=manifest.migrations?.map(name=>archived?.find(entry=>entry.name===name) ?? {name}) ?? archived;
  const recorded=historyEntries && matchMigrationLedger(historyEntries,files,replay);
  // Only explicitly acknowledged v1 recovery may use the old projection for
  // archive placement. The live destination check above remains complete, and
  // current v2 imports use their authenticated object inventory. Verified legacy
  // v2 uses the replayed complete identity; acknowledged recovery places by tables only.
  const schemaAfter=names=>replay.schemaAfter(names,legacyRecovery && manifest.schemaObjects===undefined?{legacyExcludedObjects:true}:unverified?{tablesOnly:true}:undefined);
  if(unverified && archived && manifest.migrations)insist(canonicalJson(matchMigrationLedger(archived,files,replay))===canonicalJson(recorded),'schema_mismatch:migration_history',409);
  let earlier,unapplied;
  if(recorded) {
    if(unverified)insist(recorded.every((name,i)=>applied.indexOf(name)>(i?applied.indexOf(recorded[i-1]):-1)),'schema_mismatch:migration_history',409);
    earlier=applied.filter(name=>recorded.includes(name));
    insist(await schemaAfter(earlier)===manifest.schema,'schema_mismatch');
    unapplied=applied.filter(name=>!earlier.includes(name));
  }else{
    // Unrecorded: the latest matching prefix. Migrations that change no archived
    // definition (excluded tables or data-only changes) cannot be told apart
    // and count as later. The source may have stopped at any matching prefix,
    // so every migration after the earliest one may be missing from its rows.
    const matching=[];
    for(let k=0;k<=applied.length;k++)if(await schemaAfter(applied.slice(0,k))===manifest.schema)matching.push(k);
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
  // whatever it reads; eligible catalogue backfills are replayed.
  const catalogue=cat.tables.map(t=>t.name),archivedTables=catalogue.filter(name=>manifest.tables.some(t=>t.name===name));
  const empty=archivedTables.filter(name=>!manifest.tables.find(t=>t.name===name).count);
  const tables=(await all(db,"SELECT name FROM sqlite_master WHERE type IN ('table','view')")).map(t=>t.name);
  const baseline=await replay.rowImages?.(cat.tables.filter(t=>!archivedTables.includes(t.name)).map(t=>({name:t.name,columns:t.columns.map(c=>c.name)})),0);
  const replayEmpty=baseline?[...baseline].filter(([,rows])=>!rows.length).map(([name])=>name):[];
  const {replays,rebuilt}=laterData({applied,unapplied,replay,catalogue,archived:archivedTables,empty,tables,secrets:manifest.excludedColumns??{},manifest:manifest.tables,replayEmpty});
  return {applied,earlier,replays,rebuilt};
}
// Old v2 writers recorded tables and applied migration names, but no behavioral
// object inventory (later writers omitted objects attached to excluded tables).
// Verify the archive's historical projection and the complete live replay, then
// return the recorded schema's complete identity for ordinary bridge placement.
// Never guess an unrecorded prefix or install source SQL to fill missing evidence.
export async function verifiedLegacySchema(db,manifest,cat,migrations,history) {
  if(!migrations)return false;
  const replay=await migrations(),ledger=await destinationLedger(db)??[];
  try {
    const files=replay.names.map(name=>({name,sha256:replay.sha256?.(name),aliases:replay.aliases?.(name)}));
    const archived=history(),entries=manifest.migrations?.map(name=>archived?.find(entry=>entry.name===name)??{name})??archived;
    if(!entries?.length)return false;
    const applied=matchMigrationLedger(ledger,files,replay),recorded=matchMigrationLedger(entries,files,replay);
    if(!recorded.length || canonicalJson(applied)!==canonicalJson(replay.names)
      || !recorded.every((name,i)=>applied.indexOf(name)>(i?applied.indexOf(recorded[i-1]):-1)))return false;
    if(archived && manifest.migrations && canonicalJson(matchMigrationLedger(archived,files,replay))!==canonicalJson(recorded))return false;
    if(await replay.schemaAfter(applied)!==cat.identity
      || await replay.schemaAfter(recorded,manifest.schemaObjects===undefined?{tablesOnly:true}:{legacyExcludedObjects:true})!==manifest.schema)return false;
    return await replay.schemaAfter(recorded);
  }catch{return false;} // Unknown history or a failed replay is not verification.
}
// An archive with the destination's schema identity can still predate later
// migrations that changed only data (a purge or a backfill).
// Those that change restorable data are refused like any other. Without a
// replayer the statements cannot be read, so an archive whose recorded
// migrations the destination's ledger has outgrown is refused. An archive that
// records a migration the destination never applied is newer than it, even
// when that migration left the schema as it was (an index, a data change).
export async function sameSchemaMigrations(db,manifest,cat,migrations,history) {
  const ledger=await destinationLedger(db),applied=ledger?.map(m=>m.name);
  if(!applied)return;
  if(!migrations){
    if(manifest.migrations)matchMigrationLedger(manifest.migrations.map(name=>({name})),ledger);
    insist(!manifest.migrations || applied.every(name=>manifest.migrations.includes(name)),'schema_mismatch:migrations');return;
  }
  // A data-only migration leaves the schema unchanged but still needs its
  // carried-table replay plan retained for finalize.
  const bridge=await additiveBridge(db,manifest,cat,migrations,history);
  return bridge.replays?.length?bridge:undefined;
}
// An archive made before later migrations restores only when those migrations
// are additive, or a proven row-preserving CHECK rebuild: new tables, new
// columns that take a default, or later schema objects established by replay.
// Anything else stays a schema_mismatch refusal.
export async function additiveBridge(db,manifest,cat,migrations,history,legacyRecovery,unverified=false) {
  insist(migrations,'schema_mismatch');
  const replay=await migrations(),ledger=await destinationLedger(db)??[];
  const {applied,earlier,replays,rebuilt}=await placement(db,manifest,cat,replay,ledger,history,legacyRecovery,unverified);
  const columns={};
  for(const table of manifest.tables) {
    const target=cat.tables.find(t=>t.name===table.name),label=':'+table.name;
    insist(target,'schema_mismatch:table'+label);
    const kept=target.columns.slice(0,table.columns.length),added=target.columns.slice(table.columns.length);
    insist(canonicalJson(kept)===canonicalJson(table.columns) && table.rowidAlias===target.rowidAlias && table.dependencies.every(d=>target.dependencies.includes(d)),'schema_mismatch:columns'+label);
    const rebuiltChecks=rebuilt.has(folded(table.name)) && checkRebuild(table.sql,target.sql);
    if(!added.length){insist(schemaSQL(table.sql)===schemaSQL(target.sql) || rebuiltChecks,'schema_mismatch:definition'+label);continue;}
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
