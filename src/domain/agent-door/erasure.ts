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
  if(key==='prepare')return (sql:string)=>/^INSERT INTO rer_erasure_operations\b/.test(sql)?wrap(target.prepare(sql)):target.prepare(sql);
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}
