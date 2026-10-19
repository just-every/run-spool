import { tokens, identifier, folded } from './generated.mjs';

// Migration SQL split where SQLite itself ends statements: sqlite3_complete's
// state machine (https://github.com/sqlite/sqlite/blob/master/src/complete.c,
// public domain). A trigger ends only at `; END ;`, so CASE ... END (also
// `END||x`), quoted or commented semicolons and BEGIN ... END bodies never end
// one. Runners hand over chunks from their own splitter, which can glue a
// trigger to the statements after it; each chunk is split again here before
// it is classified. Statements are returned without their final semicolon. A
// trailing trigger with no `; END` is returned as it stands: the classifier
// cannot bound it (migration-statements.mjs) and judges it as unbounded.
const transitions=[
  [1,0,2,3,4,2,2,2],// 0 invalid
  [1,1,2,3,4,2,2,2],// 1 start
  [1,2,2,2,2,2,2,2],// 2 normal
  [1,3,3,2,4,2,2,2],// 3 explain
  [1,4,2,2,2,4,5,2],// 4 create
  [6,5,5,5,5,5,5,5],// 5 trigger
  [6,6,5,5,5,5,5,7],// 6 semicolon in a trigger
  [1,7,5,5,5,5,5,5],// 7 end in a trigger
];// columns: semicolon, space, other, EXPLAIN, CREATE, TEMP/TEMPORARY, TRIGGER, END
const kinds={explain:3,create:4,temp:5,temporary:5,trigger:6,end:7};
export function splitStatements(sql) {
  const result=[];let state=0,start=0,code=false;
  for(const t of tokens(sql)) {
    const pieces=t.quoted?[{text:t.text,at:t.start}]:[...t.text.matchAll(/[A-Za-z0-9_$\u0080-￿]+|[^A-Za-z0-9_$\u0080-￿]/g)].map(m=>({text:m[0],at:t.start+m.index}));
    for(const {text,at} of pieces) {
      const kind=t.quoted?2:text===';'?0:kinds[folded(text)]??2;
      if(kind)code=true;
      state=transitions[state][kind];
      if(state!==1)continue;
      if(code)result.push(sql.slice(start,at).trim());
      start=at+1;code=false;state=0;
    }
  }
  if(code)result.push(sql.slice(start).trim());
  return result;
}

// SQLite's keywords (sqlite3_keyword_name), with the pseudo-tables a trigger
// or upsert names (NEW, OLD, excluded) and the boolean literals.
const keywords=new Set(`abort action add after all alter always analyze and as asc attach autoincrement before begin between by cascade case cast check collate column commit conflict constraint create cross current current_date current_time current_timestamp database default deferrable deferred delete desc detach distinct do drop each else end escape except exclude exclusive exists explain fail filter first following for foreign from full generated glob group groups having if ignore immediate in index indexed initially inner insert instead intersect into is isnull join key last left like limit match materialized natural no not nothing notnull null nulls of offset on or order others outer over partition plan pragma preceding primary query raise range recursive references regexp reindex release rename replace restrict returning right rollback row rows savepoint select set table temp temporary then ties to transaction trigger unbounded union unique update using vacuum values view virtual when where window with without new old excluded true false`.split(' '));
const pseudo=new Set(['new','old','excluded']);
// Words that can follow a keyword naming a table without being one: UPDATE OR,
// AFTER UPDATE ON/OF, DO UPDATE SET, TABLE IF [NOT] EXISTS.
const grammar=new Set(['or','on','of','set','if']);

// Every name in a token list (tokens()) that can be a table: identifiers in
// table position (after FROM, JOIN, INTO, UPDATE [OR ...], TABLE [IF [NOT]
// EXISTS], REFERENCES, and the ON of a CREATE INDEX or TRIGGER header), the
// qualifiers of a qualified name (`t` of t.column), and other bare
// identifiers. SQL keywords outside table position, function names (a name
// followed by `(`, also a table-valued one after FROM or JOIN), the column
// of a qualified reference, string and blob literals, numbers and comments
// never count. Names are folded.
export function tableNames(list) {
  const lex=lexemes(list),result=[],header=headerOn(lex);
  for(let i=0;i<lex.length;i++) {
    if(!named(lex[i]))continue;
    let j=i;
    while(lex[j+1]?.text==='.' && named(lex[j+2]))j+=2;
    const parts=lex.slice(i,j+1).filter((_,k)=>k%2===0),call=lex[j+1]?.text==='(',at=position(lex,i,header);
    if(at && !(lex[i].kind==='word' && grammar.has(lex[i].value))){if(at==='target' || !call)result.push(parts.at(-1).value);}
    else if(parts.length>1)result.push(...parts.slice(0,-1).filter(p=>!pseudo.has(p.value)).map(p=>p.value));
    else if(!call && !(lex[i].kind==='word' && keywords.has(lex[i].value)) && !(folded(lex[i].text)==='x' && lex[i+1]?.kind==='string'))result.push(lex[i].value);
    i=j;
  }
  return result;
}
function lexemes(list) {
  return list.flatMap(t=>t.quoted?[{kind:t.text[0]==="'"?'string':'name',text:t.text,value:folded(identifier(t))}]:
    [...t.text.matchAll(/(\d[\w$]*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_\u0080-￿][\w$\u0080-￿]*)|\S/g)]
      .map(m=>m[1]!==undefined?{kind:'number',text:m[0]}:m[2]!==undefined?{kind:'word',text:m[0],value:folded(m[0])}:{kind:'symbol',text:m[0]}));
}
const named=a=>a?.kind==='name' || a?.kind==='word';
const is=(a,value)=>a?.kind==='word' && a.value===value;
// Whether the name starting at lex[i] is in table position: 'source' (FROM,
// JOIN: a name called there is a table-valued function), 'target' otherwise.
function position(lex,i,header) {
  if(is(lex[i-1],'from') || is(lex[i-1],'join'))return 'source';
  if(['into','references','update'].some(w=>is(lex[i-1],w)) || i-1===header)return 'target';
  if(is(lex[i-2],'or') && ['update','insert'].some(w=>is(lex[i-3],w)))return 'target';
  let k=i-1;
  if(is(lex[k],'exists')){k--;if(is(lex[k],'not'))k--;if(!is(lex[k],'if'))return;k--;}
  if(is(lex[k],'table'))return 'target';
}
// The index of the ON naming the table of a CREATE [UNIQUE] INDEX or CREATE
// [TEMP] TRIGGER statement: its first ON outside parentheses.
function headerOn(lex) {
  const head=lex.slice(0,4).filter(a=>!['unique','temp','temporary'].some(w=>is(a,w)));
  if(!is(head[0],'create') || !(is(head[1],'index') || is(head[1],'trigger')))return -1;
  let depth=0;
  for(let i=0;i<lex.length;i++){if(lex[i].text==='(')depth++;else if(lex[i].text===')')depth--;else if(!depth && is(lex[i],'on'))return i;else if(!depth && is(lex[i],'begin'))return -1;}
  return -1;
}
