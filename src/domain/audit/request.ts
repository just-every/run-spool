import { ownerSession } from '../../auth/session.server';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { hash } from '../privacy';
import { mintAdmission } from '../dev-credentials';
import { mintedByCurrentPerson } from '../credential-fence';
import { auditActor, auditSubject, projectAuditLabel, serviceActor, unidentifiedActor } from './identity';
import { currentAuditScope, runAuditScope, type AuditScope } from './context';
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

/** A door whose authority is established by its own handler: an admitted
 * sign-in names the owner it signed in, an admitted Business grant its service. */
async function admittedActor(request: Request, env: Bindings, door: AuditScope, response: Response): Promise<AuditActor> {
 if(door.actor.kind!=='anonymous'||response.status>=400)return door.actor;
 if(new URL(request.url).pathname.startsWith('/auth/')){
  const cookies=response.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>value.includes('=')&&!value.endsWith('='));
  if(!cookies.length)return door.actor;
  const signedIn=await requestActor(new Request(request.url,{headers:{cookie:cookies.join('; '),host:new URL(request.url).host}}),env);
  return signedIn.kind==='owner'?signedIn:door.actor;
 }
 if(new URL(request.url).pathname.startsWith('/api/rer/import/'))return serviceActor(env.DB,'business-import');
 return door.actor;
}

/** Records the HTTP observation of every classified door, and runs the handler
 * inside its audit scope so each committed change records its transaction fact
 * in its own batch (context.ts). No response body, input, query, concrete
 * route or error text is retained. The actor is captured before a successful
 * handoff/revocation can erase authority.
 */
export async function wrapRequest(request: Request, env: Bindings, next: () => Promise<Response>): Promise<Response> {
 const door=classifyRequest(request); if(!door)return next();
 const actor=await requestActor(request,env);
 const [subject,projectLabel]=await Promise.all([
  auditSubject(env.DB,door.kind,door.project?JSON.stringify([door.project,door.subject]):door.subject,door.project),
  door.project?projectAuditLabel(env.DB,door.project):null,
 ]);
 let scope: AuditScope={actor,action:door.action,subject,projectLabel};
 const observe=async(status:number)=>{
  const fact: AuditFact={source:'request',actor:scope.actor,action:door.action,subject,projectLabel,outcome:responseOutcome(status),status};
  await recordAudit(env.DB,fact);
 };
 let response: Response;
 try { response=await runAuditScope(scope,async()=>{const result=await next();scope=currentAuditScope();return result;}); }
 catch(error) {
  await observe(error instanceof AuthError?error.status:503);
  throw error;
 }
 scope={...scope,actor:await admittedActor(request,env,scope,response)};
 // Ordinary successful reads do not swamp the action chronology. Named evidence/export
 // reads and every denied read remain observable.
 if(!(door.action==='private.action'&&['GET','HEAD'].includes(request.method)&&response.status<400))await observe(response.status);
 return response;
}
