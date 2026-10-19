import { ownerSession } from '../../auth/session.server';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { hash } from '../privacy';
import { mintAdmission } from '../dev-credentials';
import { mintedByCurrentPerson } from '../credential-fence';
import { auditActor, auditSubject, projectAuditLabel, unidentifiedActor } from './identity';
import { classifyRequest } from './classify';
import { recordAudit, responseOutcome } from './record';
import type { AuditActor, AuditFact } from './types';

/** Attribution follows existing auth admission, never supplies authority. */
export async function requestActor(request: Request, bindings: Bindings): Promise<AuditActor> {
 const env=runtimeBindings(bindings);
 let session;
 try { session=await ownerSession(request,env); }
 catch (error) { if(error instanceof AuthError)return unidentifiedActor();throw error; }
 if(session)return auditActor(env.DB,{kind:'owner',authority:session.operator.id});
 const bearer=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')??'')?.[1];
 if(!bearer)return unidentifiedActor();
 const digest=await hash(bearer);
 const grant=await env.DB.prepare(`SELECT kind,project,minted_by FROM credentials WHERE hash=? AND revoked IS NULL AND (kind='ingest' OR ${mintedByCurrentPerson}) AND ${await mintAdmission(request)}`)
  .bind(digest).first<{kind:'agent'|'deploy'|'ingest';project:string;minted_by:string|null}>();
 return grant?auditActor(env.DB,{kind:grant.kind,authority:digest,owner:grant.minted_by,project:grant.project}):unidentifiedActor();
}

/** Records HTTP observations only. Use auditStatement for atomic mutation facts.
 * No response body, input, query, concrete route or error text is retained.
 * Capture the actor before a successful handoff/revocation can erase authority.
 */
export async function wrapRequest(request: Request, env: Bindings, next: () => Promise<Response>): Promise<Response> {
 const door=classifyRequest(request); if(!door)return next();
 const actor=await requestActor(request,env);
 const [subject,projectLabel]=await Promise.all([
  auditSubject(env.DB,door.kind,door.project?JSON.stringify([door.project,door.subject]):door.subject,door.project),
  door.project?projectAuditLabel(env.DB,door.project):null,
 ]);
 const fact: Omit<AuditFact,'outcome'>={source:'request',actor,action:door.action,subject,projectLabel};
 let response: Response;
 try { response=await next(); }
 catch(error) {
  const status=error instanceof AuthError?error.status:503;
  await recordAudit(env.DB,{...fact,outcome:responseOutcome(status),status});
  throw error;
 }
 // Ordinary successful reads do not swamp the action chronology. Named evidence/export
 // reads and every denied read remain observable.
 if(!(door.action==='private.action'&&['GET','HEAD'].includes(request.method)&&response.status<400))await recordAudit(env.DB,{...fact,outcome:responseOutcome(response.status),status:response.status});
 return response;
}
