import { operatorAuth } from '../../auth/session.server';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import { hash } from '../privacy';
import { archiveProgressHeader } from '../archive-progress';
import { mintAdmission } from '../dev-credentials';
import { mintedByCurrentPerson } from '../credential-fence';
import { auditActor, auditLabel, auditLabelFromLookup, auditLabelStatements, boundAuditLabel, projectAuditLabel, randomAuditLabel, serviceActor, subjectBinding, unidentifiedActor } from './identity';
import { currentAuditScope, runAuditScope, type AuditScope } from './context';
import { classifyRequest } from './classify';
import { recordAudit, responseOutcome, unverified } from './record';
import type { AuditActor, AuditFact } from './types';

/** Attribution follows existing auth admission, never supplies authority. */
export async function requestActor(request: Request, bindings: Bindings): Promise<AuditActor> {
 const env=runtimeBindings(bindings);
 let session;
 try { session=await operatorAuth(env).getSession(request); }
 catch (error) { if(error instanceof AuthError)return unidentifiedActor();throw error; }
 const bearer=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')??'')?.[1];
 if(session&&!request.headers.has('authorization'))return auditActor(env.DB,{kind:session.operator.role==='owner'?'owner':'member',authority:session.operator.id});
 if(!bearer)return unidentifiedActor();
 const [digest,admission]=await Promise.all([hash(bearer),mintAdmission(request)]);
 const grant=await env.DB.prepare(`SELECT credentials.kind,credentials.project,credentials.minted_by,link.service
  FROM credentials LEFT JOIN spool_service_credentials link ON link.hash=credentials.hash
  WHERE credentials.hash=? AND credentials.revoked IS NULL AND ${mintedByCurrentPerson} AND ${admission}`)
  .bind(digest).first<{kind:'agent'|'deploy'|'ingest';project:string;minted_by:string|null;service:string|null}>();
 if(!grant)return unidentifiedActor();
 return auditActor(env.DB,{kind:grant.service===null?grant.kind:'service',authority:grant.service??digest,owner:grant.minted_by,project:grant.project});
}

/** A page that keeps itself current re-reads quietly: its first, foreground read is the recorded one. Signed-in people only; a credential's reads are always recorded. */
export const quietRead = (request: Request, actor: AuditActor) => request.method==='GET'&&request.headers.get('x-spool-background')==='1'&&(actor.kind==='owner'||actor.kind==='member');

/** A door whose authority is established by its own handler: an admitted
 * sign-in names the owner it signed in, an admitted Business grant its service. */
async function admittedActor(request: Request, env: Bindings, door: AuditScope, response: Response): Promise<AuditActor> {
 if(door.actor.kind!=='anonymous'||response.status>=400)return door.actor;
 if(new URL(request.url).pathname.startsWith('/auth/')){
  const cookies=response.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>value.includes('=')&&!value.endsWith('='));
  if(!cookies.length)return door.actor;
  const signedIn=await requestActor(new Request(request.url,{headers:{cookie:cookies.join('; '),host:new URL(request.url).host}}),env);
  return ['owner','member'].includes(signedIn.kind)?signedIn:door.actor;
 }
 // Business grants: the import door and the signed cutover read.
 if(new URL(request.url).pathname.startsWith('/api/rer/'))return serviceActor(env.DB,'business-import');
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
 // The bounded reads belong to one export. Record refusals and leave its
 // successful page transfers to the initial and terminal audit facts.
 const archivePage=door.action==='archive.export'&&request.headers.get(archiveProgressHeader)==='2'&&
  ['capture','schema','rows'].includes(new URL(request.url).searchParams.get('archive')??'');
 const page=archivePage?await next():undefined;
 if(page?.ok)return page;
 const actor=await requestActor(request,env);
 // A request no session or credential admitted only reads the alias of the object it names;
 // the binding waits for its handler to admit it, so refused guesses leave no durable mapping.
 const binding=subjectBinding(door.kind,door.project?JSON.stringify([door.project,door.subject]):door.subject,door.project);
 let bound:string|undefined, projectLabel:string|null;
 if(!unverified(actor)&&door.project){
  const aliases=await Promise.all([
   auditLabelStatements(env.DB,binding),
   auditLabelStatements(env.DB,subjectBinding('project',door.project,door.project)),
  ]);
  const [,subjectLookup,,projectLookup]=await env.DB.batch(aliases.flat());
  bound=auditLabelFromLookup(subjectLookup);projectLabel=auditLabelFromLookup(projectLookup);
 } else {
  [bound,projectLabel]=await Promise.all([
   unverified(actor)?boundAuditLabel(env.DB,binding):auditLabel(env.DB,binding),
   door.project?projectAuditLabel(env.DB,door.project):null,
  ]);
 }
 const subject={kind:door.kind,label:bound??randomAuditLabel()};
 let scope: AuditScope={actor,action:door.action,subject,projectLabel};
 const observe=async(status:number)=>{
  const fact: AuditFact={source:'request',actor:scope.actor,action:door.action,subject,projectLabel,outcome:responseOutcome(status),status};
  await recordAudit(env.DB,fact);
 };
 let response: Response;
 try { response=await runAuditScope(scope,async()=>{const result=page??await next();scope=currentAuditScope();return result;}); }
 catch(error) {
  await observe(error instanceof AuthError?error.status:503);
  throw error;
 }
 scope={...scope,actor:await admittedActor(request,env,scope,response)};
 if(bound===undefined&&response.status<400)await auditLabel(env.DB,binding,subject.label);
 // A progressive archive reports its real outcome from the stream.
 if(door.action==='archive.export'&&['1','2'].includes(response.headers.get(archiveProgressHeader)??''))return response;
 // Ordinary successful reads do not swamp the action chronology. Named evidence/export
 // reads and every denied read remain observable.
 if(!(door.action==='private.action'&&['GET','HEAD'].includes(request.method)&&response.status<400)&&!(door.action==='grouping.proposals'&&response.status<400&&quietRead(request,scope.actor)))await observe(response.status);
 return response;
}
