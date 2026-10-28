import {AsyncLocalStorage} from 'node:async_hooks';
import type {ToolContext} from '../../modules/agent-door/types.ts';
import type {Bindings} from '../../auth/bindings';
import {agentRequestContext} from './native-context';
const current=new AsyncLocalStorage<{kind:string;target:string;context:ToolContext}>();
export const admittedSetting=<T>(kind:string,target:string,context:ToolContext,work:()=>Promise<T>)=>current.run({kind,target,context},work);
export const settingContext=()=>current.getStore()?.context??null;
export function settingsCustody(db:D1Database,request:Request,kind:string,project:string) {
 const ctx=agentRequestContext(request);
 if(!ctx)return db.prepare('DELETE FROM spool_agent_settings_custody WHERE kind=? AND project=?').bind(kind,project);
 return db.prepare('INSERT INTO spool_agent_settings_custody(kind,project,principal) VALUES(?,?,?) ON CONFLICT(kind,project) DO UPDATE SET principal=excluded.principal').bind(kind,project,JSON.stringify({person:{id:ctx.person.id},agent:ctx.agent,consent:ctx.consent,scopes:ctx.scopes,clientId:ctx.clientId}));
}
export async function admitSetting(db:D1Database,env:Bindings|undefined,kind:'retention'|'followup',project:string,target:string,key:string) {
 const active=current.getStore();if(active?.kind===kind&&active.target===target)return true;
 const custody=await db.prepare('SELECT principal FROM spool_agent_settings_custody WHERE kind=? AND project=?').bind(kind,project).first<{principal:string}>();
 if(!custody)return true;
 // A database-only caller has no installation trust and cannot admit saved work.
 if(!env)return false;
 const {spoolDoor}=await import('./index.server');
 const result=await spoolDoor(env).invoke(kind==='retention'?'spool.retention.execute':'spool.followups.dispatch',{project,...kind==='followup'?{id:target}:{},idempotency_key:key},JSON.parse(custody.principal));
 await db.prepare('INSERT INTO spool_agent_queue_outcomes(id,answer,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET answer=excluded.answer,updated=excluded.updated').bind(key,JSON.stringify({outcome:result.outcome,code:result.code,approval:result.approval??null}),Date.now()).run();
 return false;
}
