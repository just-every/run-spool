import { statement, quote, insist } from './storage.mjs';
import { tokens, folded, identifier } from './generated.mjs';
import { changesData, dataStatement, reachingTables, triggerBodies, schemaChange, statementNames } from './migration-statements.mjs';
import { splitStatements } from './sql-text.mjs';
import { preservingRebuilds } from './rebuilds.mjs';
import { replayViews, viewReads } from './replay-views.mjs';
import { sqliteTokens } from './sqlite-tokens.mjs';
import { schemaSQL } from './schema-identity.mjs';
import { transientTables } from './transient-tables.mjs';

// The data statements of later migrations, judged by the tables they write
// (bridge.mjs placement). Restored rows never pass through a later migration.
// - A bounded INSERT, REPLACE, UPDATE or DELETE whose target lies outside the
//   restorable catalogue (an excluded, derived or platform table) and whose
//   writes reach no catalogue table through a trigger or foreign key action
//   (reachingTables) changes no restored row, whatever it reads: admitted.
// - An eligible seed or backfill of a catalogue table replays at finalize.
//   A carried table keeps its archived rows and admits only one later writer,
//   naming its target columns. An absent table is reset first; each later write is a
//   replayable INSERT or a bounded UPDATE of a newly reconstructed table. They
//   run in migration order, exactly as written, after archived rows are inserted and with the destination's triggers still
//   dropped, so the table holds what the live upgrade gave it. A replay may read
//   only archived tables (complete by then), views over those tables and the
//   table itself, by named
//   columns that are not secret; no trigger on the table may write a catalogue
//   table; no later statement may write it another way (directly or through a
//   trigger) or change its columns other than by ADD COLUMN.
// - Everything else keeps today's rule (changesData), with the tables admitted
//   writes fill from archived rows counted as archived: copying one into a
//   catalogue table is refused, since the restore does not hold its live rows.
// Each chunk the runner's splitter handed over is split again at SQLite's own
// statement boundaries first (sql-text.mjs), so a trigger glued to the
// statements after it is judged as the statements it holds.
// Returns the replays in migration order and the proven CHECK rebuilds, or refuses with the first migration
// (in `unapplied` order) holding a statement that cannot be admitted.
export function laterData({applied,unapplied,replay,catalogue,archived,empty,tables,secrets,manifest,replayEmpty=[]}) {
  const split=name=>replay.statements(name).flatMap(splitStatements),fold=list=>list.map(folded);
  const statements=applied.flatMap(split);
  const restorable=fold(catalogue),carried=fold(archived);
  const reached=reachingTables(statements,carried),writable=reachingTables(statements,restorable);
  const later=unapplied.flatMap(migration=>split(migration).map((sql,index)=>({migration,index,sql,data:dataStatement(sql)})));
  const {admitted,tables:rebuilt}=preservingRebuilds(later,manifest,tables,statements),views=replayViews(statements);
  const restored=restoreCommitStatements(applied,split,later);
  restored.forEach(s=>admitted.add(s));
  // Renaming an uncarried table is metadata-only. Later row statements still
  // face their own checks; carried table definitions still face the bridge.
  for(const s of later) {
    const list=sqliteTokens(s.sql),words=list.map(t=>folded(t.value));
    if(words.length===6 && words[0]==='alter' && words[1]==='table' && words[3]==='rename' && words[4]==='to' && !carried.includes(words[2]) && !carried.includes(words[5]))admitted.add(s);
  }
  const absentEmpty=emptyAbsentTables(later,statements,carried,replayEmpty,admitted);
  // An empty absent source contributes no row to a direct INSERT SELECT.
  for(const s of later)if(s.data && emptySelect(s.sql,absentEmpty))admitted.add(s);
  const {missing,plans:transients}=transientTables(statements,later,fold(tables),carried);
  const current=fold(tables),known=[...current,...missing],outside=later.filter(s=>s.data && !writable.includes(s.data.target) && !transients.has(s.data.target)),tainted=new Set();
  // Tables an admitted write fills from archived rows (directly, through its
  // target's triggers, or from another such table) hold rows the restore lacks.
  const taint=name=>{if(current.includes(name) && !tainted.has(name)){tainted.add(name);triggerBodies(statements,name).forEach(taint);return true;}};
  for(let grew=true;grew;)grew=outside.filter(s=>s.data.names.some(name=>carried.includes(name) || tainted.has(name))).map(s=>taint(s.data.target)).some(Boolean);
  const refused=new Set(),writes=new Map();
  for(const s of later) {
    if(outside.includes(s) || admitted.has(s))continue;
    s.today=changesData(s.sql,[...reached,...tainted],empty);
    if(s.data && (restorable.includes(s.data.target) || transients.has(s.data.target))){if(!writes.has(s.data.target))writes.set(s.data.target,[]);writes.get(s.data.target).push(s);}
    else if(s.today)refused.add(s);
  }
  const choices=new Map(),required=new Set();
  for(const [table,list] of writes) {
    // Seed INSERTs into a new table replay too: the rows already present in a
    // fresh destination must be reset and derived from the restored installation.
    const transient=transients.get(table);
    // A new target can read other new catalogue tables that the same plan
    // reconstructs. Carried targets still read only archived tables.
    // Dependencies are checked below before any of the plan is selected.
    const available=[...transients.keys(),...(!carried.includes(table)?[...writes.keys()].filter(name=>!carried.includes(name)):[])];
    const allowUpdate=!transient && !carried.includes(table) && list.some(s=>['insert','replace'].includes(s.data.verb));
    const options={table,allowUpdate,statements,restorable,writable,carried:[...carried,...absentEmpty,...available],tables:known,secrets,views,manifest};
    // Carried target rules must use the actual archive, not reconstructed reads.
    const bad=carried.includes(table) && list.length>1?list:list.filter(s=>!replayable(s,{...options,targetCarried:carried.includes(table)}));
    // Writes confined to tables created after the archive retain their
    // admission. Replay eligible seeds, but do not turn a new-table-only
    // upgrade into a refused backfill. View reads always require resolution.
    const needed=!transient && list.some(s=>s.today || s.data.names.some(name=>views.has(name)));
    if(needed)required.add(table);
    if(!needed && bad.length)continue;
    const reach=reachingTables(statements,[table]),other=later.filter(s=>s!==transient?.create && s!==transient?.drop && !admitted.has(s) && !list.includes(s) && writesAnother(s,table,reach,list));
    if(bad.length || other.length){[...bad,...other].forEach(s=>refused.add(s));continue;}
    const dependencies=list.flatMap(s=>viewReads(s.data.names,s.data.words,{...options,table}) || []).filter(name=>name!==table && !carried.includes(name));
    choices.set(table,{list,dependencies});
  }
  // Remove dependent plans together: skipping an unsupported transient must
  // never leave its consumer scheduled against a table that no longer exists.
  for(let changed=true;changed;) {
    changed=false;
    for(const [table,choice] of choices)if(choice.dependencies.some(name=>!choices.has(name))) {
      choices.delete(table);changed=true;
      if(required.has(table))choice.list.forEach(s=>refused.add(s));
    }
  }
  const replays=[...choices.values()].flatMap(c=>c.list),schema=new Map();
  for(const [table,{create,drop}] of transients)if(choices.has(table)) {
    replays.push(create,drop);schema.set(create,table);schema.set(drop,table);
  }
  const first=later.find(s=>refused.has(s));
  insist(!first,'schema_mismatch:migration_data:'+first?.migration);
  const named=Object.fromEntries(catalogue.map(name=>[folded(name),name]));
  return {rebuilt,replays:later.filter(s=>replays.includes(s)).map(s=>{
    const table=s.data?.target??schema.get(s);
    return {migration:s.migration,statement:s.index,table:named[table]??table,sql:s.sql,...(carried.includes(table)?{carried:true}:{}),...(transients.has(table)?{transient:true}:{}),...(schema.has(s)?{schema:true}:{})};
  })};
}
function replayable({data},{table,allowUpdate,statements,restorable,writable,carried,targetCarried,tables,secrets,views,manifest}) {
  if(!['insert','replace',...(allowUpdate?['update']:[])].includes(data.verb) || data.star)return false;
  if(targetCarried) {
    // sqlite_sequence's high-water mark is not archived, so replay cannot
    // reproduce a carried AUTOINCREMENT table's live key allocation.
    if(!data.columns || autoincrement(manifest.find(t=>folded(t.name)===table).sql))return false;
    // Keyed tables carry their key columns, not their hidden physical rowids.
    // Treat unarchived aliases as unreadable cells, including through views.
    secrets={...secrets};
    for(const t of manifest)if(!t.rowidAlias) {
      const hidden=['rowid','_rowid_','oid'].filter(name=>!t.columns.some(c=>folded(c.name)===name));
      secrets[t.name]=[...(secrets[t.name]??[]),...hidden];
    }
  }
  // A carried target participates in secret checks, even through a view.
  if(!viewReads(data.names,data.words,{views,tables,carried,table:targetCarried?undefined:table,secrets}))return false;
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
// inserted and before the triggers are recreated. Only absent tables are emptied
// (and their AUTOINCREMENT counters reset, as the live upgrade created them).
// Carried tables keep their archived rows. Statements run in migration order,
// recording rows in the job's bridge record (`replayed[i].rows`) in the same transaction.
export function replayStatements(db,row) {
  const replays=row.metadata.replays??[];
  const reset=[...new Set(replays.filter(r=>!r.carried && !r.transient).map(r=>r.table))].flatMap(name=>{
    const target=row.metadata.targets.find(t=>t.name===name);
    insist(target,'schema_mismatch:replay_table:'+name);
    return [statement(db,`DELETE FROM ${quote(name)}`),...(autoincrement(target.sql)?[statement(db,'DELETE FROM sqlite_sequence WHERE name=?',name)]:[])];
  });
  return [...reset,...replays.flatMap((r,i)=>[db.prepare(r.sql),
    statement(db,`UPDATE rer_portability_jobs SET metadata=json_set(metadata,'$.bridge.replayed[${i}].rows',${r.schema?'0':'changes()'}) WHERE id=?`,row.id)])];
}
const autoincrement=sql=>tokens(sql).some(t=>!t.quoted && folded(t.text)==='autoincrement');

// Only a surviving destination-owned trigger on the actual restore transition
// can cover DML. The complete body must recur contiguously, in the same file
// and order, preserving literals and identifiers. Nothing is replayed twice.
function restoreCommitStatements(applied,split,later) {
  const live=new Map();
  for(const migration of applied)for(const sql of split(migration)) {
    const list=tokens(sql),words=list.map(t=>folded(t.text));
    if(!['create','drop'].includes(words[0]) || words[1]!=='trigger')continue;
    const at=words[2]==='if'?(words[0]==='create'?5:4):2,name=folded(identifier(list[at]));
    if(words[0]==='drop'){live.delete(name);continue;}
    if(words[2]==='if' && live.has(name))continue;
    live.set(name,{migration,sql,list,at});
  }
  const admitted=new Set();
  const header='AFTER UPDATE OF import_job ON rer_portability_state WHEN OLD.import_job IS NOT NULL AND NEW.import_job IS NULL AND OLD.applying=1';
  for(const {migration,sql,list,at} of live.values()) {
    const begin=list.findIndex(t=>!t.quoted && folded(t.text)==='begin');
    if(begin<0 || schemaChange(sql)!=='trigger' || schemaSQL(sql.slice(list[at].end,list[begin].start))!==schemaSQL(header))continue;
    const end=list.at(-1);if(!/^end;?$/i.test(end.text))continue;
    const body=splitStatements(sql.slice(list[begin].end,end.start));
    if(!body.length || body.some(sql=>!dataStatement(sql)))continue;
    const file=later.filter(s=>s.migration===migration),images=body.map(schemaSQL);
    for(let i=0;i+body.length<=file.length;i++)if(images.every((image,k)=>file[i+k].data && schemaSQL(file[i+k].sql)===image))file.slice(i,i+body.length).forEach(s=>admitted.add(s));
  }
  return admitted;
}
// Prove an absent table stays empty rather than assuming every newly created
// table is empty. Full replay supplies the empty baseline; every later INSERT
// and every possible trigger writer must also preserve it. A local empty
// create/copy/drop/rename rebuild carries no row, including through its DROP.
function emptyAbsentTables(later,statements,carried,replayEmpty,admitted) {
  const empty=new Set(replayEmpty.map(folded).filter(name=>!carried.includes(name)));
  const rebuilds=[];
  for(let i=0;i+3<later.length;i++) {
    const block=later.slice(i,i+4),a=tokens(block[0].sql),b=tokens(block[1].sql),c=tokens(block[2].sql),d=tokens(block[3].sql);
    const text=list=>list.map(t=>folded(identifier(t)));
    const [aa,bb,cc,dd]=[a,b,c,d].map(text);
    if(block.some(s=>s.migration!==block[0].migration) || aa[0]!=='create' || aa[1]!=='table' || a[3]?.text!=='(' || bb.length!==7 || bb[0]!=='insert' || bb[1]!=='into' || bb[2]!==aa[2] || bb[3]!=='select' || bb[4]!=='*' || bb[5]!=='from' || cc.join(' ')!==`drop table ${bb[6]}` || dd.join(' ')!==`alter table ${aa[2]} rename to ${bb[6]}` || !empty.has(bb[6]) || carried.includes(aa[2]))continue;
    if(later.some(s=>!block.includes(s) && statementNames(s.sql).includes(aa[2])))continue;
    rebuilds.push({block,source:bb[6]});
  }
  const copyStatements=new Set(rebuilds.flatMap(r=>r.block)),triggerTargets=new Set();
  for(const sql of statements) {
    const list=tokens(sql);if(folded(list[0]?.text??'')!=='create' || folded(list[1]?.text??'')!=='trigger')continue;
    const on=list.findIndex(t=>!t.quoted && folded(t.text)==='on');
    const begin=list.findIndex(t=>!t.quoted && folded(t.text)==='begin');
    if(on<0 || begin<0 || schemaChange(sql)!=='trigger'){statementNames(sql).forEach(name=>triggerTargets.add(name));continue;}
    for(const body of splitStatements(sql.slice(list[begin].end,list.at(-1).start))) {
      const data=dataStatement(body);
      if(data)triggerTargets.add(data.target);
      else if(!/^\s*SELECT\b/i.test(body))statementNames(body).forEach(name=>triggerTargets.add(name));
    }
  }
  for(let changed=true;changed;) {
    changed=false;
    for(const name of empty) {
      const writes=later.filter(s=>s.data && s.data.target===name && !copyStatements.has(s) && ['insert','replace'].includes(s.data.verb));
      const triggered=triggerTargets.has(name);
      if(triggered || writes.some(s=>!emptySelect(s.sql,empty))) {empty.delete(name);changed=true;}
    }
  }
  for(const {block,source} of rebuilds)if(empty.has(source))block.forEach(s=>admitted.add(s));
  return [...empty];
}
function emptySelect(sql,empty) {
  const list=sqliteTokens(sql),word=t=>['keyword','identifier'].includes(t?.type)?folded(t.value):undefined;
  let depth=0,select=-1,from=-1;
  for(let i=0;i<list.length;i++) {
    const t=list[i],w=word(t);
    if(!depth && ['union','except','intersect','right','full','returning'].includes(w))return false;
    if(!depth && w==='select' && select<0)select=i;
    if(!depth && w==='from' && select>=0 && from<0)from=i;
    // An aggregate over an empty input can still produce one row. Permit
    // only known scalar expressions and EXISTS before the outer FROM.
    if(select>=0 && from<0 && list[i+1]?.text==='(' && w && !['coalesce','exists','in'].includes(w))return false;
    if(t.text==='(')depth++;if(t.text===')')depth--;
  }
  return from>select && [...empty].includes(folded(list[from+1]?.value??''));
}
