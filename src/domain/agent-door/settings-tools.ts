import {ToolRefusal} from '../../modules/agent-door/index.ts';
import type {ToolDefinition,ToolContext} from '../../modules/agent-door/types.ts';
import type {Bindings} from '../../auth/bindings';
import {admittedSetting} from './settings-custody';
import {nativeAuthority,projectPath} from './native';
import {readRetentionPolicy,retentionCutoffs} from '../retention-policy';
import {retentionRemaining,scheduledRetention} from '../retention-schedule';
import {dispatchNotices} from '../follow-up/notices';
import {activeProjectRecipient} from '../members/notifications';
import {findDestination} from '../alerts/destinations.server';
import {retentionExecutionDeclaration,followupDispatchDeclaration} from './catalogue';
export function settingTools(env:Bindings):ToolDefinition[] {
 const authorized=async(kind:string,args:Record<string,unknown>,ctx:ToolContext)=>{
  await nativeAuthority(env,projectPath(args)+(kind==='retention'?'/retention-policy':'/follow-up/alternate-member'),'PUT',ctx);
  const row=await env.DB.prepare('SELECT principal FROM spool_agent_settings_custody WHERE kind=? AND project=?').bind(kind,args.project).first<{principal:string}>();
  const principal=row?JSON.parse(row.principal):null;
  if(!principal||principal.person.id!==ctx.person.id||principal.agent.id!==ctx.agent.id)throw new ToolRefusal('not_found');
 };
 return [{...retentionExecutionDeclaration,
  async classify(args,ctx){await authorized('retention',args,ctx);const policy=await readRetentionPolicy(env.DB,String(args.project));const count=await retentionRemaining(env.DB,String(args.project),retentionCutoffs(policy.windows,ctx.now()));return [{class:count?'destructive':'standard',facts:{measure:count||1}}];},
  async summary(args,ctx){await authorized('retention',args,ctx);const policy=await readRetentionPolicy(env.DB,String(args.project));return {target:{id:String(args.project),name:'Scheduled retention'},items:[JSON.stringify(policy.windows),`Eligible records: ${await retentionRemaining(env.DB,String(args.project),retentionCutoffs(policy.windows,ctx.now()))}`]};},
  async run(args,ctx){await authorized('retention',args,ctx);const read=()=>env.DB.prepare('SELECT last_run,status,remaining FROM retention_runs WHERE project=?').bind(args.project).first();const before=await read();await admittedSetting('retention',String(args.project),ctx,()=>scheduledRetention(env.DB,ctx.now(),env,String(args.project)));const result=await read();if(JSON.stringify(before)!==JSON.stringify(result))ctx.emit('spool.retention.changed','spool://evidence');return {result:result??{status:'not_due'}};},
 },{...followupDispatchDeclaration,
  async classify(args,ctx){await authorized('followup',args,ctx);return [{class:'external',facts:{measure:1,counterparty:'known',step:'followup'}}];},
  async summary(args,ctx){await authorized('followup',args,ctx);const notice=await env.DB.prepare('SELECT destination,channel,body FROM follow_up_notices WHERE project=? AND id=?').bind(args.project,args.id).first<any>();if(!notice)throw new ToolRefusal('not_found');const recipient=notice.destination.startsWith('member:')?(await activeProjectRecipient(env.DB,String(args.project),notice.destination.slice(7)))?.email:(await findDestination(env,String(args.project),notice.destination,notice.channel)).recipient;return {target:{id:String(args.id),name:'Needs attention'},recipients:[recipient??notice.destination],items:[notice.body]};},
  async run(args,ctx){await authorized('followup',args,ctx);const read=()=>env.DB.prepare('SELECT id,state,attempts,code FROM follow_up_notices WHERE project=? AND id=?').bind(args.project,args.id).first();const before=await read();await admittedSetting('followup',String(args.id),ctx,()=>dispatchNotices(env,ctx.now(),[String(args.id)]));const result=await read();if(JSON.stringify(before)!==JSON.stringify(result))ctx.emit('spool.followups.changed','spool://evidence');return {result:result??{state:'unavailable'}};},
 }];
}
