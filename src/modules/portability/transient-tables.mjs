import { tokens, identifier, folded } from './generated.mjs';
import { schemaChange, statementNames, triggerBodies } from './migration-statements.mjs';

// A missing historical table is still a real read dependency. Reconstruct only
// a single, bounded CREATE / INSERTs / DROP wholly after the archive. No schema
// mutation, FK or trigger effects may escape this temporary lifetime.
export function transientTables(statements,later,tables,carried) {
  const history=new Map(),dropped=new Set();
  for(const sql of statements) {
    const words=tokens(sql).map(t=>t.quoted?undefined:folded(t.text));
    if(words[0]==='drop' && words[1]==='table')statementNames(sql).forEach(name=>dropped.add(name));
    const ddl=tableDDL(sql);
    if(!ddl)continue;
    if(!history.has(ddl.name))history.set(ddl.name,[]);
    history.get(ddl.name).push({...ddl,sql});
  }
  const missing=[...new Set([...history.keys(),...dropped])].filter(name=>!tables.includes(name)),plans=new Map();
  for(const name of missing) {
    const life=history.get(name);
    if(carried.includes(name) || life?.length!==2 || life[0].verb!=='create' || life[1].verb!=='drop')continue;
    const create=later.find(s=>s.sql===life[0].sql),drop=later.find(s=>s.sql===life[1].sql);
    if(!create || !drop || later.indexOf(create)>=later.indexOf(drop) || schemaChange(create.sql)!=='create table')continue;
    if(tokens(create.sql).some(t=>!t.quoted && folded(t.text)==='references') || triggerBodies(statements,name).length)continue;
    const touches=later.filter(s=>statementNames(s.sql).includes(name));
    if(touches.some(s=>s!==create && s!==drop && (!s.data || later.indexOf(s)<=later.indexOf(create) || later.indexOf(s)>=later.indexOf(drop))))continue;
    const fills=touches.filter(s=>s.data?.target===name);
    if(!fills.length || fills.some(s=>!['insert','replace'].includes(s.data.verb)))continue;
    plans.set(name,{create,drop,fills});
  }
  return {missing,plans};
}

function tableDDL(sql) {
  const list=tokens(sql),words=list.map(t=>t.quoted?undefined:folded(t.text));
  if(!['create','drop'].includes(words[0]) || words[1]!=='table')return;
  const at=words[2]==='if'?(words[0]==='create'?5:4):2,token=list[at];
  // Qualified names and unusual table syntax keep the previous admission.
  if(!token || !token.quoted && !/^[a-z_][a-z0-9_$]*$/i.test(token.text))return;
  return {name:folded(identifier(token)),verb:words[0]};
}
