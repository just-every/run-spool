import type { AgentAuthority } from './native-authority';
import { ownerBatch } from '../owner-authority';

/** Attach worker custody to the native opening statement in the same D1
 * transaction. The native service still owns its plan hash and operation id. */
export function agentErasureDatabase(db:D1Database,actor:AgentAuthority):D1Database {
 const wrap=(statement:D1PreparedStatement,args:unknown[]=[]):D1PreparedStatement=>new Proxy(statement,{get(target,key){
  if(key==='bind')return (...values:unknown[])=>wrap(target.bind(...values),values);
  if(key==='run')return async()=>{
   if(typeof args[0]!=='string')throw new Error('native_erasure_operation_missing');
   const c=actor.context,principal={person:{id:c.person.id},agent:c.agent,scopes:c.scopes,clientId:c.clientId,consent:c.consent};
   const result=await ownerBatch(db,actor,[target,db.prepare('INSERT INTO spool_erasure_agents VALUES(?,?,?)').bind(args[0],JSON.stringify(principal),JSON.stringify(c.actor))]);
   return result[0];
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
 return new Proxy(db,{get(target,key){
  if(key==='prepare')return (sql:string)=>{
   if(/^INSERT INTO rer_erasure_operations\b/.test(sql))return wrap(target.prepare(sql));
   const match=/^SELECT .+ FROM "(agent_door_approvals|agent_door_calls|agent_door_audit)" WHERE /.exec(sql);
   if(!match)return target.prepare(sql);
   const operation=actor.context.operationId;
   const clause=match[1]==='agent_door_approvals'?"json_extract(saved,'$.principal.operationId') IS NOT ?":match[1]==='agent_door_calls'?'decision_id<>?':"json_extract(row,'$.operation_id') IS NOT ?";
   const statement=target.prepare(sql+' AND ('+clause+')');
   return new Proxy(statement,{get(object,key){if(key==='bind')return (...values:unknown[])=>object.bind(...values,operation);const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;}});
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}

/** Keep the installation's decision chronology while removing every native
 * target and project-scoped policy payload. Private results still leave through
 * the ordinary erasure graph; the audit never keeps their arguments/results. */
export function eraseAgentAudit(db:D1Database,project:string):D1PreparedStatement[] {
 return [
 // Pending and execution rows share the approval handle. Preserve the actual
 // people who decided it before the graph deletes arguments, summaries and
 // results; retaining a decision does not retain permission to execute it.
 db.prepare(`UPDATE agent_door_audit SET row=json_set(row,'$.approval.by',json((
  SELECT json_group_array(DISTINCT json_extract(mark.value,'$.person'))
  FROM agent_door_approvals a,json_each(a.approvals) mark
  WHERE a.id=json_extract(agent_door_audit.row,'$.approval.id'))))
  WHERE EXISTS(SELECT 1 FROM agent_door_approvals a
   WHERE a.id=json_extract(agent_door_audit.row,'$.approval.id') AND json_extract(a.saved,'$.args.project')=?)`).bind(project),
 db.prepare(`UPDATE agent_door_audit SET row=json_set(json_remove(row,'$.trace','$.ignored_arguments'),
  '$.resource',NULL,'$.classes',json(COALESCE((SELECT json_group_array(json(CASE WHEN json_extract(value,'$.facts.service')=? THEN json_set(value,'$.facts.service','erased') ELSE value END)) FROM json_each(row,'$.classes')),'[]'))),evidence=NULL
  WHERE id IN (SELECT decision_id FROM agent_door_calls WHERE EXISTS(SELECT 1 FROM json_each(outcome,'$.resources') r WHERE json_extract(r.value,'$.uri')='spool://projects/'||? OR instr(json_extract(r.value,'$.uri'),'spool://projects/'||?||'/')=1))
  OR id IN (SELECT json_extract(saved,'$.decision_id') FROM agent_door_approvals WHERE json_extract(saved,'$.args.project')=?)
  OR id IN (SELECT json_extract(saved,'$.decision_id') FROM agent_door_reviews WHERE json_extract(saved,'$.args.project')=?)
  OR json_extract(row,'$.resource.id')=? OR json_extract(row,'$.resource')='spool://projects/'||? OR instr(json_extract(row,'$.resource'),'spool://projects/'||?||'/')=1
  OR EXISTS(SELECT 1 FROM json_tree(row,'$.classes') WHERE key='service' AND value=?)`).bind(project,project,project,project,project,project,project,project,project)];
}
