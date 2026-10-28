import api from '../api';
import { wrapRequest } from '../audit/request';
import { attributeAuditScope } from '../audit/context';
import { auditActor } from '../audit/identity';
import { withAgentRequest,withReviewerRequest } from './native-context';
import { agentReadPath } from '../agent-access';
import { mintedByCurrentPerson } from '../credential-fence';
import { ToolRefusal } from '../../modules/agent-door/index.ts';
import type { ResourceContext, ToolContext, UndoContext } from '../../modules/agent-door/types.ts';
import type { Bindings } from '../../auth/bindings';
import { spoolPeople } from './people';
import { resolveMembership } from '../members/resolver';

export const segment = (value: unknown) => encodeURIComponent(String(value));
export const projectPath = (args: Record<string, unknown>) => '/api/projects/' + segment(args.project);

export async function nativeServiceAuthority(env:Bindings,path:string,method:string,ctx:ToolContext) {
 const operator=await nativeAuthority(env,path,method,ctx);
 const authority={kind:'agent' as const,operator,agentContext:ctx};
 return operator.role==='owner'?authority:await resolveMembership(new Request(env.AUTH_ORIGIN+path,{method}),env,authority);
}

export async function nativeAuthority(env: Bindings, path: string, method: string, ctx: ResourceContext | ToolContext) {
 const person = await spoolPeople(env).person(ctx.person.id);
 if (!person?.active) throw new ToolRefusal('unauthenticated');
 if (ctx.clientId?.startsWith('spool-credential:')) {
  const grant = await env.DB.prepare(`SELECT project FROM credentials WHERE hash=? AND revoked IS NULL AND kind='agent' AND ${mintedByCurrentPerson}`).bind(ctx.clientId.slice('spool-credential:'.length)).first<{project:string}>();
  const project = /^\/api\/projects\/([^/?]+)/.exec(path)?.[1];
  if (!grant || !agentReadPath(new Request(env.AUTH_ORIGIN+path,{method}),grant.project) || !project || decodeURIComponent(project) !== grant.project || !['spool:read','spool:propose'].some(scope => ctx.scopes.includes(scope)) || !['GET','HEAD'].includes(method) && (path !== `/api/projects/${segment(grant.project)}/grouping-proposals` || !ctx.scopes.includes('spool:propose'))) throw new ToolRefusal('not_found');
 }
 const operator = await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version,created_at AS createdAt FROM oa_operators WHERE id=?').bind(person.id).first<any>();
 if (operator.role !== 'owner') {
  const result = await resolveMembership(new Request(env.AUTH_ORIGIN + path, { method }), env, { kind: 'agent', operator, agentContext: ctx as ToolContext });
  if (!result) throw new ToolRefusal('not_found');
 }
 return operator;
}

/** Invoke the production native handlers with a distinct agent principal. No
 * session is minted or borrowed, and no authorization travels over HTTP. */
export async function nativeCall(env: Bindings, path: string, method: string, body: unknown, ctx: ToolContext): Promise<any> {
 await nativeAuthority(env, path, method, ctx);
 const request = new Request(env.AUTH_ORIGIN + path, { method, headers: { origin: env.AUTH_ORIGIN, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 const response = await withAgentRequest(request, ctx, () => wrapRequest(request, env, async () => {
  attributeAuditScope(await auditActor(env.DB, { kind: 'agent', authority: ctx.agent.id, owner: ctx.person.id, project: /^\/api\/projects\/([^/?]+)/.exec(path)?.[1] ? decodeURIComponent(/^\/api\/projects\/([^/?]+)/.exec(path)![1]) : undefined }));
  return api.fetch(request, env);
 }));
 if (!response.ok) { await response.body?.cancel(); throw new ToolRefusal(response.status === 409 ? 'revision_conflict' : response.status === 401 ? 'unauthenticated' : response.status === 403 || response.status === 404 ? 'not_found' : 'native_action_refused', undefined, { status: response.status }); }
 return response.headers.get('content-type')?.includes('json')?response.json():{format:'text',text:await response.text()};
}

/** A real review Undo is a native person action, with no agent identity. */
export async function nativeReviewerCall(env:Bindings,path:string,body:unknown,ctx:UndoContext) {
 const person=await spoolPeople(env).person(ctx.person.id);if(!person?.active)throw new ToolRefusal('unauthenticated');
 const request=new Request(env.AUTH_ORIGIN+path,{method:'POST',headers:{origin:env.AUTH_ORIGIN,'content-type':'application/json'},body:JSON.stringify(body)});
 const response=await withReviewerRequest(request,ctx,()=>wrapRequest(request,env,async()=>{
  attributeAuditScope(await auditActor(env.DB,{kind:person.role==='owner'?'owner':'member',authority:person.id}));
  return api.fetch(request,env);
 }));
 if(!response.ok){await response.body?.cancel();throw new ToolRefusal(response.status===409?'revision_conflict':'not_found');}
 await response.body?.cancel();
}
