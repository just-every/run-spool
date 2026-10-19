import { tokens, identifier, folded } from './generated.mjs';
import { tableNames, splitStatements } from './sql-text.mjs';

// Whether one migration statement can change rows a restore carries. Only
// CREATE TABLE (not AS SELECT), CREATE INDEX and ALTER TABLE ... ADD COLUMN
// are additive: SQLite refuses ADD COLUMN with a non-constant default, so a
// restored row takes the same value the migration gave existing rows.
// CREATE TRIGGER and DROP TRIGGER are schema-only whatever the body does:
// neither runs the body, so no row changes when the migration runs, and a
// restore inserts rows with the destination's triggers dropped and recreates
// them afterwards (import.mjs finalizeImport), exactly as the live upgrade left
// the rows that predate the trigger. That holds only for a statement bounded
// as exactly one trigger statement; any other (INSERT, UPDATE, DELETE, table
// rebuilds, a trigger glued to a further statement) changes data unless it
// names none of `reached` (reachingTables), as when it only touches
// operator-auth or other excluded tables that no trigger links to restorable ones.
// `empty` lists the restorable tables the archive holds no rows of: restore
// leaves them empty, and an UPDATE or DELETE of an empty table changes nothing
// (no row fires a trigger either), so such a statement changes data only if it
// names another reached table (one it could write, or read into its writes).
// Any other statement naming an empty table still does: an INSERT would leave
// rows the restore lacks. A chunk holding several statements (sql-text.mjs
// splitStatements) changes data when any of them does.
export function changesData(sql,reached,empty=[]) {
  return splitStatements(sql).some(one=>statementChanges(one,reached,empty));
}
function statementChanges(sql,reached,empty) {
  const list=tokens(sql),words=list.map(t=>t.quoted?undefined:folded(t.text)),kind=kindOf(words);
  if(kind==='create table')return topLevelWords(list,words).includes('as');
  if(kind==='create index')return false;
  if(kind==='alter table' && words.find((w,i)=>i>2 && ['add','rename','drop'].includes(w))==='add')return false;
  if(kind==='create trigger' && createdTrigger(list))return false;
  if(kind==='drop trigger' && droppedTrigger(list))return false;
  const skipped=new Set(['update','delete'].includes(words[0])?empty.map(folded):[]);
  return names(list,new Set(reached.map(folded).filter(name=>!skipped.has(name))));
}
// The restorable tables and every table whose writes reach one through a
// trigger any of `statements` creates, or through a foreign key action (ON
// DELETE/UPDATE CASCADE or SET) declared by a reached table: a write to such a
// table during a later migration changes restorable rows the archive lacks. A
// trigger counts when its statement names a reached table anywhere; one this
// parser cannot bound adds every table name it holds (sql-text.mjs tableNames:
// never a keyword, function, qualified column or literal).
export function reachingTables(statements,restorable) {
  const reached=new Set(restorable.map(folded)),parsed=statements.flatMap(splitStatements).map(sql=>tokens(sql)).map(list=>({list,words:list.map(t=>t.quoted?undefined:folded(t.text))}));
  const triggers=parsed.filter(({words})=>kindOf(words)==='create trigger').map(({list})=>({list,on:createdTrigger(list)?.on}));
  const actions=parsed.filter(({words})=>['create table','alter table'].includes(kindOf(words)) && words.some((w,i)=>w==='cascade' || (w==='set' && ['delete','update'].includes(words[i-1])))).map(({list})=>referencing(list));
  for(let grew=true;grew;) {
    grew=false;
    const add=name=>{if(!reached.has(name)){reached.add(name);grew=true;}};
    for(const {list,on} of triggers)if(names(list,reached))(on===undefined?tableNames(list):[on]).forEach(add);
    for(const {table,parents} of actions)if(table===undefined?parents.some(name=>reached.has(name)):reached.has(table))parents.forEach(add);
  }
  return [...reached];
}
// The table a CREATE TABLE or ALTER TABLE statement declares and the tables its
// REFERENCES clauses name (table undefined when it cannot be read).
function referencing(list) {
  const parts=atoms(list),at=word(parts[2],'if') && word(parts[3],'not') && word(parts[4],'exists')?5:2;
  return {table:tableName(parts.slice(at,at+1)),parents:parts.flatMap((a,i)=>word(a,'references') && parts[i+1]?[tableName([parts[i+1]])].filter(Boolean):[])};
}
// The last part of a [schema.]table name read from one to three atoms.
function tableName(name) {
  const last=name.at(-1);
  if(!last || name.length>3 || name.some(a=>!a.quoted && !/^[A-Za-z0-9_$.\u0080-\uffff]+$/.test(a.text)))return;
  return folded(last.quoted?identifier(last):last.text.split('.').at(-1))||undefined;
}
// The one table a bounded INSERT, REPLACE, UPDATE or DELETE statement writes
// directly, after an optional WITH clause, with what a replay must know of it:
// {verb, target, conflict (an OR clause's resolution, 'replace' for REPLACE),
// columns (an explicit insert column list), upsert (ON CONFLICT ... DO UPDATE),
// star (a * or t.* result column), names (the table names it holds, tableNames),
// words (every identifier it holds, columns and keywords too)}. Undefined
// for any other statement or one this parser cannot bound. Triggers on the
// target and foreign key actions are the only further writes such a statement
// makes; reachingTables accounts for both.
export function dataStatement(sql) {
  const parts=atoms(tokens(sql));
  if(parts.some(semicolon))return;
  let i=0;
  if(word(parts[0],'with')) {
    i=word(parts[1],'recursive')?2:1;
    for(;;) {
      i++;// the table name
      if(parts[i]?.text==='(')i=closing(parts,i);
      if(!word(parts[i],'as'))return;
      i++;
      if(word(parts[i],'not'))i++;
      if(word(parts[i],'materialized'))i++;
      if(parts[i]?.text!=='(')return;
      i=closing(parts,i);
      if(parts[i]?.text!==',')break;
      i++;
    }
  }
  const verb=['insert','replace','update','delete'].find(v=>word(parts[i],v));
  if(!verb)return;
  let conflict=verb==='replace'?'replace':undefined;
  i++;
  if(['insert','update'].includes(verb) && word(parts[i],'or')){conflict=parts[i+1] && !parts[i+1].quoted?folded(parts[i+1].text):undefined;if(!conflict)return;i+=2;}
  if(verb!=='update'){if(!word(parts[i],verb==='delete'?'from':'into'))return;i++;}
  const name=[];
  const joined=a=>!name.length || (!a.quoted && a.text.startsWith('.')) || (!name.at(-1).quoted && name.at(-1).text.endsWith('.'));
  for(;i<parts.length && !['(',',',')'].includes(parts[i].text) && joined(parts[i]);i++)name.push(parts[i]);
  const target=tableName(name);
  if(!target)return;
  if(word(parts[i],'as'))i+=2;
  const star=parts.some((a,k)=>!a.quoted && /(^|\.)\*$/.test(a.text) && !(parts[k-1]?.text==='(' && parts[k+1]?.text===')'));
  const upsert=parts.some((a,k)=>word(a,'do') && word(parts[k+1],'update'));
  return {verb,target,conflict,columns:verb==='insert' || verb==='replace'?parts[i]?.text==='(':undefined,upsert,star,names:tableNames(parts),words:identifiers(parts)};
}
// The index after the parenthesized group opening at `start`, or the end when unbalanced.
function closing(parts,start) {
  let depth=0;
  for(let i=start;i<parts.length;i++){if(parts[i].quoted)continue;if(parts[i].text==='(')depth++;else if(parts[i].text===')' && !--depth)return i+1;}
  return parts.length;
}
// The table names in the bodies of triggers on `table` that `statements`
// create, and every one in a trigger this parser cannot bound that names the table.
export function triggerBodies(statements,table) {
  const result=[];
  for(const list of statements.flatMap(splitStatements).map(sql=>tokens(sql))) {
    if(kindOf(list.map(t=>t.quoted?undefined:folded(t.text)))!=='create trigger')continue;
    const created=createdTrigger(list);
    if(!created){if(tableNames(list).includes(table))result.push(...tableNames(list));}
    else if(created.on===table)result.push(...tableNames(atoms(list).slice(created.begin+1)));
  }
  return result;
}
// What a statement that changes only the schema does: 'create table' (not AS
// SELECT), 'create index', 'drop index', 'create view', 'drop view', 'add
// column' or 'trigger' (a bounded CREATE or DROP TRIGGER); undefined otherwise.
export function schemaChange(sql) {
  const list=tokens(sql),words=list.map(t=>t.quoted?undefined:folded(t.text)),kind=kindOf(words);
  if(kind==='create table')return topLevelWords(list,words).includes('as')?undefined:kind;
  if(['create index','drop index','create view','drop view'].includes(kind))return kind;
  if(kind==='alter table' && words.find((w,i)=>i>2 && ['add','rename','drop'].includes(w))==='add')return 'add column';
  if(kind==='create trigger' && createdTrigger(list) || kind==='drop trigger' && droppedTrigger(list))return 'trigger';
}
export const statementNames=sql=>tableNames(tokens(sql));
const kindOf=words=>words.slice(0,4).filter(w=>!['temp','temporary','unique'].includes(w)).slice(0,2).join(' ');
const identifiers=list=>list.flatMap(t=>t.quoted?(t.text.startsWith("'")?[]:[folded(identifier(t))]):folded(t.text).split(/[^a-z0-9_$\u0080-\uffff]+/).filter(Boolean));
const names=(list,reached)=>tableNames(list).some(name=>reached.has(name));
// Tokens with each unquoted ';' split out, and trailing ones dropped.
function atoms(list) {
  const result=list.flatMap(t=>t.quoted?[t]:t.text.split(/(;)/).filter(Boolean).map(text=>({text})));
  while(result.length && semicolon(result.at(-1)))result.pop();
  return result;
}
const semicolon=a=>!a.quoted && a.text===';';
const word=(a,value)=>a && !a.quoted && folded(a.text)===value;
// {on} for CREATE [TEMP] TRIGGER ... ON table ... BEGIN statement; ... END and
// nothing after it. The body ends at the first END that starts a statement;
// CASE ... END inside a statement does not. Anything else is unbounded.
function createdTrigger(list) {
  const parts=atoms(list);let depth=0,begin=-1,on;
  for(let i=0;i<parts.length && begin<0;i++) {
    const a=parts[i];
    if(a.quoted)continue;
    if(a.text===';')return;
    if(a.text==='(')depth++;
    else if(a.text===')'){if(--depth<0)return;}
    else if(!depth && on===undefined && word(a,'on')) {
      const name=[];
      for(let j=i+1;j<parts.length && !['for','when','begin'].some(w=>word(parts[j],w));j++)name.push(parts[j]);
      const last=name.at(-1);
      if(!last || name.length>3)return;
      on=folded(last.quoted?identifier(last):last.text.split('.').at(-1));
      if(!on)return;
    }else if(!depth && word(a,'begin'))begin=i;
  }
  if(begin<0 || on===undefined)return;
  let start=true,statements=0;
  for(let i=begin+1;i<parts.length;i++) {
    const a=parts[i];
    if(start && word(a,'end'))return i===parts.length-1 && statements && !depth?{on,begin}:undefined;
    if(semicolon(a)){if(start || depth)return;start=true;statements++;continue;}
    if(!a.quoted){if(a.text==='(')depth++;else if(a.text===')' && --depth<0)return;}
    start=false;
  }
}
// DROP TRIGGER [IF EXISTS] [schema.]name, and nothing after it.
function droppedTrigger(list) {
  const parts=atoms(list),from=word(parts[2],'if') && word(parts[3],'exists')?4:2,name=parts.slice(from);
  return name.length>=1 && name.length<=3 && name.every(a=>a.quoted?!a.text.startsWith("'"):!/[;(),]/.test(a.text));
}
function topLevelWords(list,words) {
  let depth=0;const result=[];
  list.forEach((t,i)=>{if(t.text==='(')depth++;else if(t.text===')')depth--;else if(!depth)result.push(words[i]);});
  return result;
}
