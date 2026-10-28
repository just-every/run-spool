import type { Operator } from '../../modules/operator-auth/index.mjs';
import type { ToolContext } from '../../modules/agent-door/index.ts';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import type { Bindings } from '../../auth/bindings';
import type { Membership, TeamSession } from '../members/model';
import { resolveMembership } from '../members/resolver';
import { agentReadPath } from '../agent-access';
import { mintedByCurrentPerson } from '../credential-fence';

/** A native actor, deliberately without a browser session id or cookie. Only
 * the server's registry bridge can attach it to an exact Request object. */
export interface AgentAuthority {
 kind: 'agent'; operator: Operator; membership?: Membership; context: ToolContext;
 policy: {envelope:string|null;local_revision:number};
 operation: { id: string; tool: string; project: string | null; target: string };
}
export type NativeAuthority = TeamSession | AgentAuthority | ReviewerAuthority;
export const localCredentialId=(clientId?:string)=>clientId?.startsWith('spool-key:')?clientId.slice(10):null;
const actors = new WeakMap<Request, AgentAuthority>();
export const agentAuthority = (request: Request) => actors.get(request);

export async function withAgentAuthority<T>(request: Request, env: Bindings, ctx: ToolContext,
 operation: AgentAuthority['operation'], run: () => Promise<T>): Promise<T> {
 const operator = await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version,created_at AS createdAt FROM oa_operators WHERE id=?')
  .bind(ctx.person.id).first<Operator>();
 if (!operator || operator.status !== 'active') throw new Error('native_sponsor_unavailable');
 const policy=await env.DB.prepare('SELECT envelope,local_revision FROM agent_door_state WHERE id=1').first<{envelope:string|null;local_revision:number}>();
 // Read-only classification also runs before the first policy is adopted.
 // The write guard still requires an actual current policy row.
 actors.set(request, {kind:'agent',operator,context:ctx,operation,policy:policy??{envelope:null,local_revision:0}});
 try { return await run(); } finally { actors.delete(request); }
}

export async function requestAuthority(request: Request, env: Bindings, resolver = resolveMembership): Promise<NativeAuthority | null> {
 const actor = actors.get(request)??reviewers.get(request);
 if (!actor) return ownerSession(request,env,resolver);
 // Re-read on every native admission; a saved role is never authority.
 const current = await env.DB.prepare('SELECT status,version FROM oa_operators WHERE id=?').bind(actor.operator.id).first<{status:string;version:number}>();
 if (current?.status !== 'active' || current.version !== actor.operator.version) return null;
 if (actor.kind==='agent'&&localCredentialId(actor.context.clientId)) {
  const grant = await env.DB.prepare(`SELECT project FROM credentials WHERE hash=? AND kind='agent' AND revoked IS NULL AND ${mintedByCurrentPerson}`)
   .bind(localCredentialId(actor.context.clientId)).first<{project:string}>();
  if (!grant || !agentReadPath(request,grant.project)) return null;
 }
 return actor.operator.role === 'owner' ? actor : resolver(request,env,actor);
}
export const nativeWrite = (request: Request, env: Bindings) => actors.has(request) || reviewers.has(request) || ownerWrite(request,env);

/** The same transaction fence as a person action, using the native sponsor
 * and current grants instead of manufacturing an oa_sessions row. */
export function agentGuard(db: D1Database, actor: AgentAuthority) {
 const m=actor.membership;
 return db.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(
 SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.version=? AND o.role=?
 ${m ? `AND EXISTS(SELECT 1 FROM spool_members m WHERE m.id=? AND m.operator_id=o.id AND m.version=? AND m.role=? AND m.organization=? AND m.state='active'
 ${m.project ? `AND EXISTS(SELECT 1 FROM spool_project_teams t WHERE t.project=? AND t.organization=m.organization)
 ${m.role==='admin'?'':`AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=? AND g.role=?)`}`:''})` : "AND o.role='owner'"}
 ${localCredentialId(actor.context.clientId) ? `AND EXISTS(SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='agent' AND revoked IS NULL AND ${mintedByCurrentPerson})`:''}
 AND EXISTS(SELECT 1 FROM agent_door_state policy WHERE policy.id=1 AND policy.local_paused=0 AND policy.envelope IS ? AND policy.local_revision=?
 AND (policy.envelope IS NULL OR (json_extract(policy.envelope,'$.paused')=0 AND json_extract(policy.envelope,'$.exp')*1000>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND NOT EXISTS(SELECT 1 FROM json_each(policy.envelope,'$.revoked.agents') WHERE value=?)
 AND NOT EXISTS(SELECT 1 FROM json_each(policy.envelope,'$.revoked.consents') WHERE value=?))))
 AND NOT EXISTS(SELECT 1 FROM agent_door_agents a WHERE a.id=? AND a.revoked=1)
 ) THEN 1 ELSE 0 END`).bind(actor.operator.id,actor.operator.version,actor.operator.role,
 ...m?[m.id,m.version,m.role,m.organization,...m.project?[m.project,...m.role==='admin'?[]:[m.project,m.projectRole]]:[]]:[],
 ...localCredentialId(actor.context.clientId)?[localCredentialId(actor.context.clientId),actor.operation.project]:[],
 actor.policy.envelope,actor.policy.local_revision,actor.context.agent.id,actor.context.consent??'',actor.context.agent.id);
}

export function nativeAttribution(db: D1Database, actor: AgentAuthority) {
 const {operation,context}=actor;
 return db.prepare(`INSERT INTO spool_agent_operations(id,project,target,tool,actor,approvers,created)
 SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_context WHERE committed=1)
 ON CONFLICT(id) DO NOTHING`).bind(operation.id,operation.project,operation.target,operation.tool,
 JSON.stringify(context.actor),JSON.stringify(context.approvers),context.now());
}

/** Review Undo is a verified person's act, with no agent identity or borrowed
 * session. The shared review door supplies this server-only context. */
export interface ReviewerAuthority {kind:'reviewer';operator:Operator;membership?:Membership}
const reviewers=new WeakMap<Request,ReviewerAuthority>();
export const reviewerAuthority=(request:Request)=>reviewers.get(request);
export async function withReviewerAuthority<T>(request:Request,env:Bindings,personId:string,run:()=>Promise<T>):Promise<T>{
 const operator=await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version,created_at AS createdAt FROM oa_operators WHERE id=?').bind(personId).first<Operator>();
 if(!operator||operator.status!=='active')throw new Error('native_reviewer_unavailable');
 reviewers.set(request,{kind:'reviewer',operator});try{return await run();}finally{reviewers.delete(request);}
}
export function reviewerGuard(db:D1Database,actor:ReviewerAuthority){
 const m=actor.membership;
 return db.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.version=? AND o.role=?
 ${m?`AND EXISTS(SELECT 1 FROM spool_members m WHERE m.id=? AND m.operator_id=o.id AND m.version=? AND m.role=? AND m.organization=? AND m.state='active'
 ${m.project?`AND EXISTS(SELECT 1 FROM spool_project_teams t WHERE t.project=? AND t.organization=m.organization) ${m.role==='admin'?'':`AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=? AND g.role=?)`}`:''})`:"AND o.role='owner'"}) THEN 1 ELSE 0 END`)
 .bind(actor.operator.id,actor.operator.version,actor.operator.role,...m?[m.id,m.version,m.role,m.organization,...m.project?[m.project,...m.role==='admin'?[]:[m.project,m.projectRole]]:[]]:[]);
}
