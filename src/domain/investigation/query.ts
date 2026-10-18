/** All event predicates must match the same occurrence, not different events in a group. */
export function eventQuery(query: string) {
 if(query.length>1000)throw new Error('Search is limited to 1000 characters');
 const terms=query.match(/(?:[^\s"]|"[^"]*")+/g)??[], clauses:string[]=[], args:any[]=[];
 const contains=(sql:string,value:string)=>{clauses.push(`instr(lower(COALESCE(${sql},'')),lower(?))>0`);args.push(value)};
 for(const term of terms){
  const split=term.indexOf(':'),key=split<0?'text':term.slice(0,split),value=(split<0?term:term.slice(split+1)).replace(/^"|"$/g,'');
  if(!value)throw new Error(`Search value required for ${key}`);
  switch(key){
   case 'text': contains(`json_extract(e.payload,'$.message')||' '||json_extract(e.payload,'$.type')||' '||e.issue||' '||json_extract(e.payload,'$.frames')||' '||COALESCE(json_extract(e.payload,'$.sentry.exceptions'),'')`,value);break;
   case '!has':if(value!=='release')throw new Error('Only !has:release is supported');clauses.push("e.release=''");break;
   case 'has':if(value!=='release')throw new Error('Only has:release is supported');clauses.push("e.release<>''");break;
   case 'release': clauses.push(value==='latest'?`e.release=(SELECT name FROM releases WHERE project=e.project ORDER BY seq DESC LIMIT 1)`:'e.release=?');if(value!=='latest')args.push(value);break;
   case 'environment': clauses.push('e.environment=?');args.push(value);break;
   case 'message':contains(`json_extract(e.payload,'$.message')`,value);break;
   case 'error.value':clauses.push(`(instr(lower(json_extract(e.payload,'$.message')),lower(?))>0 OR EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE instr(lower(json_extract(x.value,'$.value')),lower(?))>0))`);args.push(value,value);break;
   case 'error.type':clauses.push(`(json_extract(e.payload,'$.type')=? OR EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE json_extract(x.value,'$.type')=?))`);args.push(value,value);break;
   case 'error.mechanism':clauses.push(`EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE json_extract(x.value,'$.mechanism.type')=?)`);args.push(value);break;
   case 'error.handled':case 'error.unhandled':if(!['true','false'].includes(value))throw new Error(`${key} requires true or false`);clauses.push(`EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE json_extract(x.value,'$.mechanism.handled')=?)`);args.push((key==='error.handled')===(value==='true')?1:0);break;
   case 'stack':case 'function':contains(`json_extract(e.payload,'$.frames')||' '||COALESCE(json_extract(e.payload,'$.sentry.exceptions'),'')||' '||COALESCE(json_extract(e.payload,'$.sentry.stacktrace'),'')`,value);break;
   case 'after':case 'before':{const at=Date.parse(value);if(!Number.isFinite(at))throw new Error(`Invalid ${key} date`);clauses.push(`e.received${key==='after'?'>=':'<'}?`);args.push(at);break;}
   default:
    if(key.startsWith('user.')||!/^[-a-zA-Z0-9_.]{1,100}$/.test(key))throw new Error(`Unsupported search field: ${key}`);
    clauses.push(`EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.tags') tag WHERE tag.key=? AND CAST(tag.value AS TEXT)=?)`);args.push(key,value);
  }
 }
 return {sql:clauses.length?clauses.map(value=>`(${value})`).join(' AND '):'1',args};
}
