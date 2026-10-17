/** All event predicates must match the same occurrence, not different events in a group. */
export function eventQuery(query: string) {
 if(query.length>1000)throw new Error('Search is limited to 1000 characters');
 const terms=query.match(/(?:[^\s"]|"[^"]*")+/g)??[], clauses:string[]=[], args:any[]=[];
 const contains=(sql:string,value:string)=>{clauses.push(`instr(lower(COALESCE(${sql},'')),lower(?))>0`);args.push(value)};
 for(const term of terms){
  const split=term.indexOf(':'),key=split<0?'text':term.slice(0,split),value=(split<0?term:term.slice(split+1)).replace(/^"|"$/g,'');
  if(!value)throw new Error(`Search value required for ${key}`);
  switch(key){
   case 'text': contains(`json_extract(e.payload,'$.message')||' '||json_extract(e.payload,'$.type')||' '||e.issue||' '||json_extract(e.payload,'$.frames')`,value);break;
   case 'release': clauses.push(value==='latest'?`e.release=(SELECT name FROM releases WHERE project=e.project ORDER BY seq DESC LIMIT 1)`:'e.release=?');if(value!=='latest')args.push(value);break;
   case 'environment': clauses.push('e.environment=?');args.push(value);break;
   case 'message':case 'error.value':contains(`json_extract(e.payload,'$.message')`,value);break;
   case 'error.type':clauses.push(`json_extract(e.payload,'$.type')=?`);args.push(value);break;
   case 'stack':case 'function':contains(`json_extract(e.payload,'$.frames')`,value);break;
   case 'after':case 'before':{const at=Date.parse(value);if(!Number.isFinite(at))throw new Error(`Invalid ${key} date`);clauses.push(`e.received${key==='after'?'>=':'<'}?`);args.push(at);break;}
   default:throw new Error(`Unsupported search field: ${key}`);
  }
 }
 return {sql:clauses.length?clauses.map(value=>`(${value})`).join(' AND '):'1',args};
}
