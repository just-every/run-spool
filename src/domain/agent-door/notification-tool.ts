import {notificationDeclaration} from './catalogue';
import {ToolRefusal} from '../../modules/agent-door/index.ts';
import type {ToolDefinition} from '../../modules/agent-door/types.ts';
import type {Bindings} from '../../auth/bindings';
import {admittedNotification,notificationCustody} from './queued';
import {nativeAuthority,projectPath} from './native';
import {dispatchMail} from '../alerts/mail';
import {webhookService,synchronizeHistory} from '../alerts/dispatch';
import {findDestination} from '../alerts/destinations.server';
export function notificationTool(env:Bindings):ToolDefinition {
 const read=async(args:Record<string,unknown>,ctx:any)=>{
  await nativeAuthority(env,projectPath(args)+'/alerting/rules','POST',ctx);
  const custody=await notificationCustody(env.DB,String(args.id));
  if(!custody||custody.project!==args.project)throw new ToolRefusal('not_found');
  const who=JSON.parse(custody.principal);
  if(who.person.id!==ctx.person.id||who.agent.id!==ctx.agent.id)throw new ToolRefusal('not_found');
  const intent=await env.DB.prepare('SELECT id,project,channel,destination,body,event,rule_revision FROM alert_intents WHERE project=? AND id=?').bind(args.project,args.id).first<any>();
  if(!intent)throw new ToolRefusal('not_found');
  return intent;
 };
 return {...notificationDeclaration,
  async classify(args,ctx){const intent=await read(args,ctx);return [{class:'external',facts:{measure:1,counterparty:'known',provider:intent.channel,step:'notification'}}];},
  async summary(args,ctx){const intent=await read(args,ctx),d=await findDestination(env,intent.project,intent.destination,intent.channel);return {target:{id:intent.id,name:intent.event},recipients:[d.recipient??d.label],items:[intent.body]};},
  async run(args,ctx){const intent=await read(args,ctx);await admittedNotification(intent.id,ctx,async()=>{if(intent.channel==='mail')await dispatchMail(env,Date.now(),[intent.id]);else await webhookService(env,intent.project,Date.now).dispatch(intent.id);});await synchronizeHistory(env,Date.now());const row=await env.DB.prepare('SELECT id,state,attempts,code FROM alert_history WHERE project=? AND id=?').bind(args.project,args.id).first();return {result:row??{id:intent.id,state:'unavailable'}};},
 };
}
