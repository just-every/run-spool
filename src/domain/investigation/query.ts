import { latestReleaseSql } from '../releases/order';
// Agent packets omit SDK source lines and frame locals (sentry/agent-evidence.ts); an agent's
// predicates read the same projection, so a match never answers for a field the packet withholds.
const frames=(source:string)=>`SELECT json_remove(f.value,'$.pre_context','$.context_line','$.post_context','$.vars') v FROM ${source} f`;
const joined=(parts:string)=>`(SELECT group_concat(v,' ') FROM (${parts}))`;
const stored={exceptions:`json_extract(e.payload,'$.sentry.exceptions')`,stacktrace:`json_extract(e.payload,'$.sentry.stacktrace')`};
const agentVisible={
 exceptions:joined(`SELECT json_remove(x.value,'$.stacktrace') v FROM json_each(e.payload,'$.sentry.exceptions') x UNION ALL ${frames("json_each(e.payload,'$.sentry.exceptions') x,json_each(x.value,'$.stacktrace.frames')")}`),
 stacktrace:joined(frames("json_each(e.payload,'$.sentry.stacktrace.frames')")),
};
/** All event predicates must match the same occurrence, not different events in a group. */
export function eventQuery(query: string, agent = false) {
 if(query.length>1000)throw new Error('Search is limited to 1000 characters');
 const terms=query.match(/(?:[^\s"]|"[^"]*")+/g)??[], clauses:string[]=[], args:any[]=[];
 let usesLatest=false,reviewPending=false;
 const {exceptions,stacktrace}=agent?agentVisible:stored;
 const contains=(sql:string,value:string)=>{clauses.push(`instr(lower(COALESCE(${sql},'')),lower(?))>0`);args.push(value)};
 for(const term of terms){
  const split=term.indexOf(':'),key=split<0?'text':term.slice(0,split),value=(split<0?term:term.slice(split+1)).replace(/^"|"$/g,'');
  if(!value)throw new Error(`Search value required for ${key}`);
  switch(key){
   case 'review':if(value!=='pending'||agent)throw new Error('Owner review:pending is the only review filter');reviewPending=true;break;
   case 'text': contains(`json_extract(e.payload,'$.message')||' '||json_extract(e.payload,'$.type')||' '||e.issue||' '||json_extract(e.payload,'$.frames')||' '||COALESCE(${exceptions},'')`,value);
    // TEAM-004: an exact short ID or alias, in any case, finds the issue it resolves to.
    clauses.push(`(${clauses.pop()} OR EXISTS(SELECT 1 FROM issue_short_ids s WHERE s.short_id=upper(?) AND s.project=e.project AND s.issue=e.issue))`);args.push(value);break;
   case '!has':if(value!=='release')throw new Error('Only !has:release is supported');clauses.push("e.release=''");break;
   case 'has':if(value!=='release')throw new Error('Only has:release is supported');clauses.push("e.release<>''");break;
   case 'release': usesLatest ||= value==='latest';clauses.push(value==='latest'?`e.release=${latestReleaseSql('e.project')}`:'e.release=?');if(value!=='latest')args.push(value);break;
   case 'environment': clauses.push('e.environment=?');args.push(value);break;
   case 'message':contains(`json_extract(e.payload,'$.message')`,value);break;
   case 'error.value':clauses.push(`(instr(lower(json_extract(e.payload,'$.message')),lower(?))>0 OR EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE instr(lower(json_extract(x.value,'$.value')),lower(?))>0))`);args.push(value,value);break;
   case 'error.type':clauses.push(`(json_extract(e.payload,'$.type')=? OR EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE json_extract(x.value,'$.type')=?))`);args.push(value,value);break;
   case 'error.mechanism':clauses.push(`EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE json_extract(x.value,'$.mechanism.type')=?)`);args.push(value);break;
   case 'error.handled':case 'error.unhandled':if(!['true','false'].includes(value))throw new Error(`${key} requires true or false`);clauses.push(`EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.exceptions') x WHERE json_extract(x.value,'$.mechanism.handled')=?)`);args.push((key==='error.handled')===(value==='true')?1:0);break;
   case 'stack':case 'function':contains(`json_extract(e.payload,'$.frames')||' '||COALESCE(${exceptions},'')||' '||COALESCE(${stacktrace},'')`,value);break;
   case 'after':case 'before':{const at=Date.parse(value);if(!Number.isFinite(at))throw new Error(`Invalid ${key} date`);clauses.push(`e.received${key==='after'?'>=':'<'}?`);args.push(at);break;}
   default:
    if(key.startsWith('user.')||!/^[-a-zA-Z0-9_.]{1,100}$/.test(key))throw new Error(`Unsupported search field: ${key}`);
    clauses.push(`EXISTS(SELECT 1 FROM json_each(e.payload,'$.sentry.tags') tag WHERE tag.key=? AND CAST(tag.value AS TEXT)=?)`);args.push(key,value);
  }
 }
 return {sql:clauses.length?clauses.map(value=>`(${value})`).join(' AND '):'1',args,usesLatest,reviewPending,hasEventTerms:clauses.length>0};
}
