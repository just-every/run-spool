import { ToolRefusal, type ToolContext, type ToolDefinition } from '../../modules/agent-door/index.ts';
import type { Bindings } from '../../auth/bindings';
import type { AlertEnvironment } from '../alerts/types';
import { withAgentAuthority, requestAuthority, type AgentAuthority } from './native-authority';
import { ownerBatch } from '../owner-authority';
import { auditActor, auditSubject, projectAuditLabel } from '../audit/identity';
import { runAuditScope } from '../audit/context';

type Environment = Bindings & AlertEnvironment;
type Kind = 'alert-mail' | 'alert-webhook' | 'followup' | 'retention';
const active = new WeakSet<D1Database>();
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

async function job(env:Environment,kind:Kind,id:string) {
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
 const {spoolAgentDoor}=await import('./index.server');
 const item=row.item??`${id}:${row.attempts+1}`;
 await spoolAgentDoor(env).invoke(`spool.workers.${kind.replaceAll('-','_')}`,{id,item,idempotency_key:row.principal.idempotencyKey},row.principal);
 return true;
}

/** Every native write in the worker retains the same final authority fence and
 * named agent/approvers as an immediate native action. No session is minted. */
function workerDatabase(db:D1Database,actor:AgentAuthority):D1Database {
 return new Proxy(db,{get(target,key){
  if(key==='batch')return (statements:D1PreparedStatement[])=>ownerBatch(target,actor,statements);
  if(key==='prepare')return (sql:string)=>{
   const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>new Proxy(statement,{get(object,key){
    if(key==='bind')return (...values:any[])=>wrap(object.bind(...values));
    if(/^(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql.trim())&&['run','all','first'].includes(String(key)))return async(column?:string)=>{
     const [result]=await ownerBatch(target,actor,[statement]);
     return key==='first'?(column?(result.results[0] as any)?.[column]:result.results[0]??null):result;
    };
    const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
   }});return wrap(target.prepare(sql));
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}

export function standingTools(env:Environment):ToolDefinition[] {
 return (['alert-mail','alert-webhook','followup','retention'] as Kind[]).map(kind=>({
  name:`spool.workers.${kind.replaceAll('-','_')}`,title:'Continue native standing work',description:'Execute one retained native attempt under its original sponsor, consent and current company policy.',exposure:'invoke',
  scope:kind.startsWith('alert-')?'spool:alerts':kind==='followup'?'spool:followups':'spool:retention',readOnly:false,
  inputSchema:{type:'object',additionalProperties:false,required:['id','item'],properties:{id:{type:'string'},item:{type:'string'}}},outputSchema:{type:'object'},
  classes:kind==='retention'?['live','destructive']:['live','external'],clauses:['BASE-AGENT-007','BASE-AGENT-011','BASE-AGENT-012'],
  async continuationItem(args){const row=await job(env,kind,String(args.id));if(!row)return null;
   if(args.item!==(row.item??`${args.id}:${row.attempts+1}`))return null;
   return {id:String(args.item),operationId:row.principal.operationId};},
  async classify(args){const row=await job(env,kind,String(args.id));if(!row)throw new ToolRefusal('not_found');return [{class:'live',facts:{measure:1,service:row.project}},kind==='retention'?{class:'destructive',facts:{measure:1}}:{class:'external',facts:{measure:1,counterparty:'known',provider:kind==='alert-webhook'?'configured webhook':'configured notification',step:'native standing notification'}}];},
  async summary(args){const row=await job(env,kind,String(args.id));return {target:{id:String(args.id),name:kind},items:[`Native attempt ${args.item}`,`Project ${row?.project}`]};},
  async target(args){const row=await job(env,kind,String(args.id));return row?{kind:kind==='retention'?'project':'delivery',id:String(args.id)}:null;},
  async run(args,ctx){
   const row=await job(env,kind,String(args.id));if(!row||row.principal.operationId!==ctx.operationId)throw new ToolRefusal('operation_mismatch');
   const path=kind.startsWith('alert-')?`alerting/rules/${encodeURIComponent(row.config_id)}`:kind==='followup'?'follow-up/alternate':'retention-policy';
   const request=new Request(new URL(`/api/projects/${encodeURIComponent(row.project)}/${path}`,env.AUTH_ORIGIN),{method:'PUT'});
   return withAgentAuthority(request,env,ctx,{id:crypto.randomUUID(),tool:`spool.workers.${kind.replaceAll('-','_')}`,project:row.project,target:String(args.id)},async()=>{
    const actor=await requestAuthority(request,env);if(!actor||actor.kind!=='agent')throw new ToolRefusal('not_found');
    const db=workerDatabase(env.DB,actor),workerEnv={...env,DB:db};active.add(db);
    const scope={actor:await auditActor(env.DB,{kind:'agent',authority:ctx.agent.id,owner:ctx.person.id,project:row.project}),action:kind==='retention'?'retention.scheduled' as const:'private.action' as const,subject:await auditSubject(env.DB,'project',row.project,row.project),projectLabel:await projectAuditLabel(env.DB,row.project)};
    try {await runAuditScope(scope,async()=>{
     if(kind==='alert-mail'){const {dispatchMail}=await import('../alerts/mail');await dispatchMail(workerEnv,Date.now(),[String(args.id)]);}
     else if(kind==='alert-webhook'){const {webhookService}=await import('../alerts/webhook.server');await webhookService(workerEnv,row.project,Date.now).dispatch(String(args.id));}
     else if(kind==='followup'){const {dispatchNotices}=await import('../follow-up/notices');await dispatchNotices(workerEnv,Date.now(),[String(args.id)]);}
     else {const {readRetentionPolicy,retentionCutoffs}=await import('../retention-policy');const {applyRetention}=await import('../retention');const {retentionBatchLimit}=await import('../retention-schedule');
      const policy=await readRetentionPolicy(db,row.project);if(policy.held||policy.revision!==row.revision)throw new ToolRefusal('revision_conflict');
      const cutoffs=retentionCutoffs(policy.windows,Date.now());await applyRetention(db,row.project,cutoffs.events,cutoffs,retentionBatchLimit);
     }
    });return {result:{id:String(args.id),item:String(args.item),state:'attempted'}};
    }finally{active.delete(db);}
   });
  },
 }));
}
