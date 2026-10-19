import { tokens, identifier, folded } from './generated.mjs';

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
// rows the restore lacks.
export function changesData(sql,reached,empty=[]) {
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
// trigger any of `statements` creates: a write to such a table during a later
// migration changes restorable rows the archive lacks. A trigger counts when
// its statement names a reached table anywhere; one this parser cannot bound
// adds every name it holds.
export function reachingTables(statements,restorable) {
  const reached=new Set(restorable.map(folded));
  const triggers=statements.map(sql=>tokens(sql)).filter(list=>kindOf(list.map(t=>t.quoted?undefined:folded(t.text)))==='create trigger')
    .map(list=>({list,on:createdTrigger(list)?.on}));
  for(let grew=true;grew;) {
    grew=false;
    for(const {list,on} of triggers)if(names(list,reached))for(const name of on===undefined?identifiers(list):[on])if(!reached.has(name)){reached.add(name);grew=true;}
  }
  return [...reached];
}
const kindOf=words=>words.slice(0,4).filter(w=>!['temp','temporary','unique'].includes(w)).slice(0,2).join(' ');
const identifiers=list=>list.flatMap(t=>t.quoted?(t.text.startsWith("'")?[]:[folded(identifier(t))]):folded(t.text).split(/[^a-z0-9_$\u0080-\uffff]+/).filter(Boolean));
const names=(list,reached)=>identifiers(list).some(name=>reached.has(name));
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
    if(start && word(a,'end'))return i===parts.length-1 && statements && !depth?{on}:undefined;
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
