import { ownerSession, ownerWrite } from '../../auth/session.server';
import { ownerBatch } from '../owner-authority';
export const s=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
export const guard=(db:D1Database,sql:string,...args:any[])=>s(db,`INSERT INTO operator_guards SELECT CASE WHEN (${sql}) THEN 1 ELSE 0 END`,...args);
export async function authorize(c:any){
 const session=await ownerSession(c.req.raw,c.env);
 if(!session)return {response:c.json({error:'Owner session required'},401)};
 if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,c.env))return {response:c.json({error:'Same-origin required'},403)};
 return {session};
}
export async function body(c:any){
 const reader=c.req.raw.body?.getReader();if(!reader)throw new Error('Missing body');const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new Error('Body exceeds limit')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return JSON.parse(new TextDecoder().decode(bytes));
}
export const audit=(db:D1Database,project:string,kind:string,detail:any)=>s(db,'INSERT INTO audit VALUES(?,?,?,?,?)',crypto.randomUUID(),project,kind,JSON.stringify(detail),Date.now());
export const write=(c:any,session:any,jobs:D1PreparedStatement[])=>ownerBatch(c.env.DB,session,[...jobs,s(c.env.DB,'DELETE FROM operator_guards')]);
export function conflict(c:any,error:unknown){if(/operator_guards|operator_revision_or_occurrence_conflict/.test(String(error)))return c.json({error:'Revision or occurrence conflict; preview again'},409);if(/correction_history_full|suppression_policy_full/.test(String(error)))return c.json({error:'Operator history capacity reached'},409);throw error}
