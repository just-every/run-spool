import { tokens, identifier, folded } from './generated.mjs';
import { statementNames, reachingTables } from './migration-statements.mjs';

const word=(t,w)=>t && !t.quoted && folded(t.text)===w;
const name=t=>t && (t.quoted?t.text[0]!=="'":/^[A-Za-z_\u0080-\uffff][\w$\u0080-\uffff]*$/.test(t.text))?folded(identifier(t)):undefined;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const lex=sql=>tokens(sql);
function groups(list) {
  const result=[[]];let depth=0;
  for(const t of list) {
    if(t.text==='(')depth++;
    if(t.text===')')depth--;
    if(t.text===',' && !depth)result.push([]);else result.at(-1).push(t);
  }
  return result;
}
// A definition may change CHECKs, while every column declaration, other
// constraint, collation, default, generated expression and table option stays.
export function checkRebuild(before,after) {
  const shape=sql=>{
    const list=lex(sql),open=list.findIndex(t=>t.text==='(');let depth=0,close=-1;
    for(let i=open;i<list.length;i++){if(list[i].text==='(')depth++;if(list[i].text===')' && !--depth){close=i;break;}}
    if(open<0 || close<0)return;
    const declarations=groups(list.slice(open+1,close)).map(part=>{
      const kept=[];
      for(let i=0;i<part.length;i++) {
        if(word(part[i],'constraint') && word(part[i+2],'check')){i+=2;}
        if(word(part[i],'check') && part[i+1]?.text==='(') {
          let d=0;i++;
          do {if(part[i].text==='(')d++;if(part[i].text===')')d--;i++;}while(i<part.length && d);
          if(d)return ['unbounded'];
          i--;continue;
        }
        kept.push(part[i]);
      }
      return kept;
    }).filter(part=>part.length);
    return [...declarations.map(part=>part.map(normal)),list.slice(close+1).map(normal)];
  };
  const a=shape(before),b=shape(after);
  return a!==undefined && b!==undefined && same(a,b);
}
const normal=t=>t.quoted?(t.text[0]==="'"?t.text:folded(identifier(t))):folded(t.text);
function declaration(sql) {
  const list=lex(sql);
  if(!word(list[0],'create') || !word(list[1],'table') || !name(list[2]) || list[3]?.text!=='(')return;
  let depth=0,close=-1;
  for(let i=3;i<list.length;i++){if(list[i].text==='(')depth++;if(list[i].text===')' && !--depth){close=i;break;}}
  if(close<0)return;
  const columns=groups(list.slice(4,close)).filter(p=>!['constraint','primary','unique','check','foreign'].some(w=>word(p[0],w))).map(p=>name(p[0]));
  if(columns.some(c=>!c))return;
  return {name:name(list[2]),columns};
}
function select(list,columns) {
  if(!word(list[0],'select'))return;
  const from=list.findIndex(t=>word(t,'from'));
  if(from<0 || from!==list.length-2 || !name(list.at(-1)))return;
  const projection=groups(list.slice(1,from)).flatMap(part=>part.length===1 && part[0].text==='*'?columns.map(c=>({source:c,name:c})):
    part.length===1 && name(part[0])?[{source:name(part[0]),name:name(part[0])}]:
    part.length===3 && word(part[1],'as') && name(part[0]) && name(part[2])?[{source:name(part[0]),name:name(part[2])}]:[{source:undefined}]);
  if(projection.some(p=>!p.source))return;
  return {table:name(list.at(-1)),projection};
}
const drop=(sql,table)=>{const t=lex(sql);return t.length===3 && word(t[0],'drop') && word(t[1],'table') && name(t[2])===table;};
function copied(block,table) {
  const [copy,removed,created,insert,cleaned]=block.map(s=>s.sql),head=lex(copy),target=declaration(created);
  if(!target || target.name!==folded(table.name) || !word(head[0],'create') || !word(head[1],'table') || !name(head[2]) || !word(head[3],'as'))return;
  const temporary=name(head[2]),saved=select(head.slice(4),target.columns);
  if(!saved || saved.table!==target.name || temporary===target.name || !drop(removed,target.name) || !drop(cleaned,temporary))return;
  const put=lex(insert);
  if(!word(put[0],'insert') || !word(put[1],'into') || name(put[2])!==target.name)return;
  let at=3,columns=target.columns;
  if(put[at]?.text==='('){const end=put.findIndex((t,i)=>i>at && t.text===')');if(end<0)return;columns=groups(put.slice(at+1,end)).map(p=>p.length===1?name(p[0]):undefined);at=end+1;}
  const restored=select(put.slice(at),saved.projection.map(p=>p.name));
  if(!restored || restored.table!==temporary || restored.projection.length!==columns.length || new Set(columns).size!==columns.length)return;
  const mapping=columns.map((column,i)=>({column,source:saved.projection.find(p=>p.name===restored.projection[i].source)?.source}));
  if(!target.columns.every(c=>mapping.some(m=>m.column===c && m.source===c)))return;
  if(!table.columns.every(c=>target.columns.includes(folded(c.name))) || table.columns.some(c=>c.generated))return;
  // A populated archive requires an explicit rowid round trip, even for a
  // table whose declared key makes its rowid incidental to archive identity.
  if(table.count && !mapping.some(m=>['rowid','_rowid_','oid'].includes(m.column) && ['rowid','_rowid_','oid'].includes(m.source) && !target.columns.includes(m.column) && !target.columns.includes(m.source)))return;
  if(mapping.some(m=>!m.source || (!target.columns.includes(m.column) && !['rowid','_rowid_','oid'].includes(m.column))))return;
  return temporary;
}
// Admit only a complete, local copy/drop/create/copy-back/drop sequence. The
// manifest supplies counts; no restored rows are scanned to classify SQL.
// Statements outside the block still face the normal data classifier.
export function preservingRebuilds(later,manifest,known,statements) {
  const admitted=new Set(),tables=new Set();
  for(let i=0;i+4<later.length;i++) {
    const block=later.slice(i,i+5);
    if(block.some(s=>s.migration!==block[0].migration))continue;
    const table=manifest.find(t=>folded(t.name)===declaration(block[2].sql)?.name);
    if(!table)continue;
    const temporary=copied(block,table);
    if(!temporary || known.map(folded).includes(temporary))continue;
    if(later.some(s=>!block.includes(s) && statementNames(s.sql).includes(temporary)))continue;
    const foreignKeys=statements.filter(sql=>{const t=lex(sql);return (word(t[0],'create') || word(t[0],'alter')) && word(t[1],'table');});
    if(table.count && reachingTables(foreignKeys,manifest.filter(t=>t!==table).map(t=>t.name)).includes(folded(table.name)))continue;
    // CHECK-only changes are verified against the archived definition too;
    // dropping/changing a column never earns a definition exemption.
    if(!checkRebuild(table.sql,block[2].sql))continue;
    block.forEach(s=>admitted.add(s));tables.add(folded(table.name));i+=4;
  }
  return {admitted,tables};
}
