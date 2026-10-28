import {AsyncLocalStorage} from 'node:async_hooks';
import type {ToolContext} from '../../modules/agent-door/types.ts';
import type {Bindings} from '../../auth/bindings';
import type {AlertEnvironment} from '../alerts/types';
import {agentRequestContext} from './native-context';

const executing=new AsyncLocalStorage<{id:string;context:ToolContext}>();
export const notificationContext=()=>executing.getStore()?.context??null;
export const admittedNotification=<T>(id:string,context:ToolContext,work:()=>Promise<T>)=>executing.run({id,context},work);

/** This statement follows the native rule UPDATE inside the same guarded batch.
 * A person's later edit removes agent custody; an old revision cannot inherit it. */
export function ruleCustody(db:D1Database,request:Request,rule:string,change:string) {
 const ctx=agentRequestContext(request);
 if(!ctx)return db.prepare('DELETE FROM spool_agent_rule_custody WHERE rule=? AND EXISTS(SELECT 1 FROM audit WHERE id=?)').bind(rule,change);
 const principal={person:{id:ctx.person.id},agent:ctx.agent,consent:ctx.consent,scopes:ctx.scopes,clientId:ctx.clientId};
 return db.prepare('INSERT INTO spool_agent_rule_custody(rule,revision,principal) SELECT id,revision,? FROM alert_rules WHERE id=? AND EXISTS(SELECT 1 FROM audit WHERE id=?) ON CONFLICT(rule) DO UPDATE SET revision=excluded.revision,principal=excluded.principal').bind(JSON.stringify(principal),rule,change);
}
export async function notificationCustody(db:D1Database,id:string) {
 return db.prepare(`SELECT c.principal,i.project FROM spool_agent_rule_custody c JOIN alert_intents i ON i.rule_id=c.rule AND i.rule_revision=c.revision WHERE i.id=?`).bind(id).first<{principal:string;project:string}>();
}

/** Return true only to the final native dispatch admitted by the shared door.
 * Other callers hand off to typed invoke, retaining agent, sponsor and consent. */
export async function admitNotification(env:AlertEnvironment,id:string,attempt=0):Promise<boolean> {
 if(executing.getStore()?.id===id)return true;
 const custody=await notificationCustody(env.DB,id);
 if(!custody)return true;
 const {spoolDoor}=await import('./index.server');
 const answer=await spoolDoor(env as Bindings).invoke('spool.notifications.dispatch',{project:custody.project,id,idempotency_key:`notification:${id}:${attempt}`},JSON.parse(custody.principal));
 await env.DB.prepare('INSERT INTO spool_agent_queue_outcomes(id,answer,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET answer=excluded.answer,updated=excluded.updated').bind(id,JSON.stringify({outcome:answer.outcome,code:answer.code,approval:answer.approval??null}),Date.now()).run();
 return false;
}
export async function notificationAttribution(env:AlertEnvironment,id:string):Promise<string|null> {
 const custody=await notificationCustody(env.DB,id);if(!custody)return null;
 const principal=JSON.parse(custody.principal),person=await env.DB.prepare('SELECT display_name FROM oa_operators WHERE id=?').bind(principal.person.id).first<{display_name:string}>();
 return person?`${principal.agent.name} for ${person.display_name}`:null;
}
