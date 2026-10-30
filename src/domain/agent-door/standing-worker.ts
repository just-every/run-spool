import { ToolRefusal, type ToolContext, type ToolDefinition } from '../../modules/agent-door/index.ts';
import type { Bindings } from '../../auth/bindings';
import type { AlertEnvironment } from '../alerts/types';
import { withAgentAuthority, requestAuthority, type AgentAuthority } from './native-authority';
import { ownerBatch } from '../owner-authority';
import { auditActor, auditSubject, projectAuditLabel } from '../audit/identity';
import { runAuditScope } from '../audit/context';

import { active, job } from './standing';

type Environment = Bindings & AlertEnvironment;
type Kind = 'alert-mail' | 'alert-webhook' | 'followup' | 'retention';

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
