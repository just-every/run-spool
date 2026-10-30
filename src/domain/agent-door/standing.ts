import type { AgentDoor, ToolContext } from '../../modules/agent-door/index.ts';
import type { Bindings } from '../../auth/bindings';
import type { AlertEnvironment } from '../alerts/types';

type Environment = Bindings & AlertEnvironment;
type Kind = 'alert-mail' | 'alert-webhook' | 'followup' | 'retention';
export const active = new WeakSet<D1Database>();
type StandingDoor = Pick<AgentDoor,'invoke'>;
let door:((env:Environment)=>StandingDoor)|undefined;
/** Installed by the Worker entry; archive libraries never import worker effects. */
export function registerStandingDoor(factory:(env:Environment)=>StandingDoor) { door=factory; }
const configs = {alert:['alert_rules','id'],followup:['follow_up_settings','project'],retention:['retention_policies','project']} as const;

/** The native configuration and its originating admission commit together.
 * A later person revision supersedes this binding rather than borrowing it. */
export function standingDatabase(db:D1Database, route:string, args:Record<string,any>, ctx:ToolContext):D1Database {
 const kind=route==='alert'?'alert':route==='followup'?'followup':'retention';
 const [table,key]=configs[kind],id=String(key==='project'?args.project:args.id);
 const principal={person:{id:ctx.person.id},agent:ctx.agent,scopes:ctx.scopes,clientId:ctx.clientId,consent:ctx.consent,operationId:ctx.operationId,idempotencyKey:ctx.idempotencyKey};
 return new Proxy(db,{get(target,property){
  if(property==='batch')return async(statements:D1PreparedStatement[])=>{
   // Native ownerBatch also performs empty admission batches. Only bind custody
   // in the transaction containing the actual configuration statement.
   const writes=statements.some(statement=>new RegExp(`^(?:INSERT INTO|UPDATE) ${table}\\b`,'i').test((statement as any).__standingSql??''));
   if(!writes)return target.batch(statements);
   const binding=target.prepare(`INSERT INTO spool_agent_custody(kind,id,project,principal,actor)
    SELECT ?,?,?,json_set(?,'$.revision',revision),? FROM ${table} WHERE ${key}=? AND project=?
    ON CONFLICT(kind,id) DO UPDATE SET principal=excluded.principal,actor=excluded.actor`)
    .bind(kind,id,args.project,JSON.stringify(principal),JSON.stringify(ctx.actor),id,args.project);
   const result=await target.batch([...statements,binding]);return result.slice(0,-1);
  };
  if(property==='prepare')return (sql:string)=>{
   const mark=(statement:D1PreparedStatement):D1PreparedStatement=>new Proxy(statement,{get(object,key){
    if(key==='__standingSql')return sql;
    if(key==='bind')return (...values:any[])=>mark(object.bind(...values));
    const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
   }});
   return mark(target.prepare(sql));
  };
  const value=Reflect.get(target,property,target);return typeof value==='function'?value.bind(target):value;
 }});
}

export async function job(env:Environment,kind:Kind,id:string) {
 const sql=kind==='alert-mail'?`SELECT j.id,j.project,j.attempts,i.rule_id config_id,r.revision FROM alert_mail_jobs j JOIN alert_intents i ON i.id=j.id JOIN alert_rules r ON r.id=i.rule_id AND r.project=i.project AND r.revision=i.rule_revision AND r.enabled=1 WHERE j.id=?`:
  kind==='alert-webhook'?`SELECT d.id,i.project,d.attempts,i.rule_id config_id,r.revision FROM integration_deliveries d JOIN alert_intents i ON d.id=i.id AND d.namespace='spool.'||i.project JOIN alert_rules r ON r.id=i.rule_id AND r.project=i.project AND r.revision=i.rule_revision AND r.enabled=1 WHERE d.id=?`:
  kind==='followup'?`SELECT n.id,n.project,n.attempts,c.project config_id,c.revision FROM follow_up_notices n JOIN follow_up_settings c ON c.project=n.project AND c.destination=n.destination AND c.channel=n.channel WHERE n.id=? AND NOT EXISTS(SELECT 1 FROM spool_follow_up_alternates a WHERE a.project=n.project)`:
  `SELECT r.project id,r.project,r.generation item,r.project config_id,p.revision FROM retention_runs r JOIN retention_policies p ON p.project=r.project WHERE r.project=? AND r.status='running' AND p.held=0`;
 const row=await env.DB.prepare(sql).bind(id).first<any>();if(!row)return null;
 const configKind=kind.startsWith('alert-')?'alert':kind;
 const saved=await env.DB.prepare('SELECT principal FROM spool_agent_custody WHERE kind=? AND id=? AND project=?').bind(configKind,row.config_id,row.project).first<{principal:string}>();
 if(!saved)return null;
 const principal=JSON.parse(saved.principal);
 if(principal.revision!==row.revision)return null;
 return {...row,principal};
}

/** Return true when the agent door owns the attempt (including a hold or
 * refusal). A native person configuration continues on its existing path. */
export async function dispatchStanding(env:Environment,kind:Kind,id:string):Promise<boolean> {
 if(active.has(env.DB))return false;
 const row=await job(env,kind,id);if(!row)return false;
 if(!door)throw new Error('native_worker_admission_unavailable');
 const item=row.item??`${id}:${row.attempts+1}`;
 await door(env).invoke(`spool.workers.${kind.replaceAll('-','_')}`,{id,item,idempotency_key:row.principal.idempotencyKey},row.principal);
 return true;
}

