import { statement, quote, insist } from './storage.mjs';
import { tokens, folded } from './generated.mjs';
import { changesData, dataStatement, reachingTables, triggerBodies, schemaChange, statementNames } from './migration-statements.mjs';
import { splitStatements } from './sql-text.mjs';

// The data statements of later migrations, judged by the tables they write
// (bridge.mjs placement). Restored rows never pass through a later migration.
// - A bounded INSERT, REPLACE, UPDATE or DELETE whose target lies outside the
//   restorable catalogue (an excluded, derived or platform table) and whose
//   writes reach no catalogue table through a trigger or foreign key action
//   (reachingTables) changes no restored row, whatever it reads: admitted.
// - One whose target is a catalogue table the archive does not carry (restored
//   empty) and that today's rule refuses (it reads archived rows: a backfill)
//   is replayed at finalize. Every later write to that table must then be a
//   replayable INSERT: they run in migration order, exactly as written, after
//   the archived rows are inserted and with the destination's triggers still
//   dropped, so the table holds what the live upgrade gave it. A replay may read
//   only archived tables (complete by then) and the table itself, by named
//   columns that are not secret; no trigger on the table may write a catalogue
//   table; no later statement may write it another way (directly or through a
//   trigger) or change its columns other than by ADD COLUMN.
// - Everything else keeps today's rule (changesData), with the tables admitted
//   writes fill from archived rows counted as archived: copying one into a
//   catalogue table is refused, since the restore does not hold its live rows.
// Each chunk the runner's splitter handed over is split again at SQLite's own
// statement boundaries first (sql-text.mjs), so a trigger glued to the
// statements after it is judged as the statements it holds.
// Returns the replays in migration order, or refuses with the first migration
// (in `unapplied` order) holding a statement that cannot be admitted.
export function laterData({applied,unapplied,replay,catalogue,archived,empty,tables,secrets}) {
  const split=name=>replay.statements(name).flatMap(splitStatements),fold=list=>list.map(folded);
  const statements=applied.flatMap(split);
  const restorable=fold(catalogue),carried=fold(archived),absent=restorable.filter(name=>!carried.includes(name));
  const reached=reachingTables(statements,carried),writable=reachingTables(statements,restorable);
  const later=unapplied.flatMap(migration=>split(migration).map((sql,index)=>({migration,index,sql,data:dataStatement(sql)})));
  const known=fold(tables),outside=later.filter(s=>s.data && !writable.includes(s.data.target)),tainted=new Set();
  // Tables an admitted write fills from archived rows (directly, through its
  // target's triggers, or from another such table) hold rows the restore lacks.
  const taint=name=>{if(known.includes(name) && !tainted.has(name)){tainted.add(name);triggerBodies(statements,name).forEach(taint);return true;}};
  for(let grew=true;grew;)grew=outside.filter(s=>s.data.names.some(name=>carried.includes(name) || tainted.has(name))).map(s=>taint(s.data.target)).some(Boolean);
  const refused=new Set(),writes=new Map();
  for(const s of later) {
    if(outside.includes(s))continue;
    s.today=changesData(s.sql,[...reached,...tainted],empty);
    if(s.data && absent.includes(s.data.target)){if(!writes.has(s.data.target))writes.set(s.data.target,[]);writes.get(s.data.target).push(s);}
    else if(s.today)refused.add(s);
  }
  const replays=[];
  for(const [table,list] of writes) {
    if(!list.some(s=>s.today))continue;
    const bad=list.filter(s=>!replayable(s,{table,statements,restorable,writable,carried,tables:known,secrets}));
    const reach=reachingTables(statements,[table]),other=later.filter(s=>!list.includes(s) && writesAnother(s,table,reach,list));
    if(bad.length || other.length){[...bad,...other].forEach(s=>refused.add(s));continue;}
    replays.push(...list);
  }
  const first=later.find(s=>refused.has(s));
  insist(!first,'schema_mismatch:migration_data:'+first?.migration);
  const named=Object.fromEntries(catalogue.map(name=>[folded(name),name]));
  return later.filter(s=>replays.includes(s)).map(s=>({migration:s.migration,statement:s.index,table:named[s.data.target],sql:s.sql}));
}
function replayable({data},{table,statements,restorable,writable,carried,tables,secrets}) {
  if(!['insert','replace'].includes(data.verb) || data.star)return false;
  const reads=data.names.filter(name=>tables.includes(name) && name!==table);
  if(!reads.every(name=>carried.includes(name)))return false;
  if(reads.some(name=>Object.entries(secrets).some(([t,columns])=>folded(t)===name && columns.some(c=>data.words.includes(folded(c))))))return false;
  if(triggerBodies(statements,table).some(name=>writable.includes(name)))return false;
  // Foreign key actions: a row the replay deletes or rekeys (REPLACE, upsert) must reach no other catalogue table.
  return !reachingTables(statements,restorable.filter(name=>name!==table)).includes(table);
}
// Whether a later statement other than the table's replays writes it, through a
// trigger as well, or changes its columns other than by ADD COLUMN.
function writesAnother(s,table,reach,replays) {
  if(s.data)return reach.includes(s.data.target);
  if(!statementNames(s.sql).includes(table))return false;
  const shape=schemaChange(s.sql);
  if(shape==='add column')return !replays.every(r=>r.data.columns);
  return !['create table','create index','drop index','create view','drop view','trigger'].includes(shape);
}
// Finalize statements for the job's replays, to run after the archived rows are
// inserted and before the triggers are recreated: each replayed table is
// emptied (and its AUTOINCREMENT counter reset, as the live upgrade created it)
// and the statements run in migration order. Each records the rows it wrote in
// the job's bridge record (`replayed[i].rows`), in the same transaction.
export function replayStatements(db,row) {
  const replays=row.metadata.replays??[];
  const reset=[...new Set(replays.map(r=>r.table))].flatMap(name=>{
    const target=row.metadata.targets.find(t=>t.name===name);
    insist(target,'schema_mismatch:replay_table:'+name);
    const sequenced=tokens(target.sql).some(t=>!t.quoted && folded(t.text)==='autoincrement');
    return [statement(db,`DELETE FROM ${quote(name)}`),...(sequenced?[statement(db,'DELETE FROM sqlite_sequence WHERE name=?',name)]:[])];
  });
  return [...reset,...replays.flatMap((r,i)=>[db.prepare(r.sql),
    statement(db,`UPDATE rer_portability_jobs SET metadata=json_set(metadata,'$.bridge.replayed[${i}].rows',changes()) WHERE id=?`,row.id)])];
}
