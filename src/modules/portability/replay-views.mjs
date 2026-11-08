import { tokens, identifier, folded } from './generated.mjs';
import { statementNames, dataStatement } from './migration-statements.mjs';

// Resolve the latest view definitions in the applied history, rather than
// trusting an independently edited sqlite_master view. Nested views resolve
// recursively; cycles and reads of non-carried tables refuse replay.
export function replayViews(statements) {
  const views=new Map();
  for(const sql of statements) {
    const list=tokens(sql),words=list.map(t=>t.quoted?undefined:folded(t.text));
    if(!['create','drop'].includes(words[0]) || words[1]!=='view')continue;
    const at=words[2]==='if'?(words[0]==='create'?5:4):2,name=folded(identifier(list[at]));
    if(words[0]==='drop'){views.delete(name);continue;}
    const as=list.findIndex((t,i)=>i>at && !t.quoted && folded(t.text)==='as');
    if(as<0){views.set(name,undefined);continue;}
    const body=sql.slice(list[as].end),data=dataStatement('INSERT INTO rer_view_probe '+body);
    views.set(name,{names:statementNames(body),words:data?.words??[],star:data?.star});
  }
  return views;
}
export function viewReads(names,words,{views,tables,carried,table,secrets},seen=new Set()) {
  const reads=[];
  for(const name of names.filter(n=>tables.includes(n) && n!==table)) {
    if(!views.has(name)){if(!carried.includes(name))return false;reads.push(name);continue;}
    const view=views.get(name);
    if(!view || seen.has(name))return false;
    const nested=viewReads(view.names,[...words,...view.words],{views,tables,carried,table,secrets},new Set([...seen,name]));
    if(!nested)return false;
    // A wildcard could expose a secret column through a renamed view output.
    if(view.star && nested.some(n=>Object.entries(secrets).some(([t,columns])=>folded(t)===n && columns.length)))return false;
    reads.push(...nested);
  }
  if(reads.some(name=>Object.entries(secrets).some(([t,columns])=>folded(t)===name && columns.some(c=>words.includes(folded(c))))))return false;
  return reads;
}
