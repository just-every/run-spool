import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { AuthError } from '../../modules/operator-auth/errors.mjs';
import { requireOrigin } from '../../modules/operator-auth/http.mjs';
import { archiveProgressHeader } from '../archive-progress';
import { mintAdmission } from '../dev-credentials';
import { credentialDigest, mintedByCurrentPerson, noteNonAgentCapture } from '../credential-fence';
import { auditActor, auditLabel, auditLabelFromLookup, auditLabelStatements, boundAuditLabel, projectAuditLabel, randomAuditLabel, serviceActor, subjectBinding, unidentifiedActor } from './identity';
import { currentAuditScope, runAuditScope, type AuditScope } from './context';
import { classifyRequest } from './classify';
import { recordAudit, responseOutcome, unverified } from './record';
import type { AuditActor, AuditFact } from './types';

type RequestIdentity = Parameters<typeof auditActor>[1];
type RequestBinding = ReturnType<typeof subjectBinding>;
type RequestAliases = {actor:AuditActor;bound:string;projectLabel:string};

export async function bindRequestAliases(db:D1Database,identity:RequestIdentity,binding:RequestBinding,project:string):Promise<RequestAliases> {
 const aliases=await Promise.all([
  auditLabelStatements(db,identity),
  auditLabelStatements(db,binding),
  auditLabelStatements(db,subjectBinding('project',project,project)),
 ]);
 const [,actorLookup,,subjectLookup,,projectLookup]=await db.batch(aliases.flat());
 return {
  actor:{kind:identity.kind,label:auditLabelFromLookup(actorLookup)},
  bound:auditLabelFromLookup(subjectLookup),
  projectLabel:auditLabelFromLookup(projectLookup),
 };
}

export type BindRequestAliases = (identity:RequestIdentity,binding:RequestBinding,project:string)=>Promise<RequestAliases>;
type RequestCredential = {kind:'agent'|'deploy'|'ingest';project:string;minted_by:string|null;service:string|null};
export function lookupRequestCredential(db:D1Database,digest:string,admission:string) {
 return db.prepare(`SELECT credentials.kind,credentials.project,credentials.minted_by,link.service
  FROM credentials LEFT JOIN spool_service_credentials link ON link.hash=credentials.hash
  WHERE credentials.hash=? AND credentials.revoked IS NULL AND ${mintedByCurrentPerson} AND ${admission}`)
  .bind(digest).first<RequestCredential>();
}
export type RequestAuditWork = {
 lookupCredential:(digest:string)=>Promise<RequestCredential|null>;
 bindAliases:BindRequestAliases;
 observe:(fact:AuditFact)=>Promise<void>;
};

/** Attribution follows existing auth admission. The handler checks the live grant. */
async function requestIdentity(request: Request, bindings: Bindings, nativeCapture = false, work?: RequestAuditWork): Promise<RequestIdentity | null> {
 const env=runtimeBindings(bindings);
 const bearer=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')??'')?.[1];
 let session;
 try {
  if(nativeCapture&&bearer&&!request.headers.has('cookie')) {
   // A cookie-free SDK request has no person session. Attribution still
   // requires the same Host and origin checks before reading its bearer.
   requireOrigin(request,{origin:env.AUTH_ORIGIN,local:env.AUTH_LOCAL==='true'});
  } else {
   const {operatorAuth}=await import('../../auth/session.server');
   session=await operatorAuth(env).getSession(request);
  }
 } catch (error) { if(error instanceof AuthError)return null;throw error; }
 if(session&&!request.headers.has('authorization'))return {kind:session.operator.role==='owner'?'owner':'member',authority:session.operator.id,owner:session.operator.id};
 if(!bearer)return null;
 const digest=await credentialDigest(request,bearer);
 const grant=work ? await work.lookupCredential(digest) : await lookupRequestCredential(env.DB,digest,await mintAdmission(request));
 if(!grant)return null;
 if(nativeCapture&&grant.kind!=='agent')noteNonAgentCapture(request);
 return {kind:grant.service===null?grant.kind:'service',authority:grant.service??digest,owner:grant.minted_by,project:grant.project};
}

export async function requestActor(request: Request, env: Bindings): Promise<AuditActor> {
 const identity=await requestIdentity(request,env);
 return identity?auditActor(env.DB,identity):unidentifiedActor();
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
export async function wrapRequest(request: Request, env: Bindings, next: () => Promise<Response>, work?: RequestAuditWork): Promise<Response> {
 const door=classifyRequest(request); if(!door)return next();
 // The bounded reads belong to one export. Record refusals and leave its
 // successful page transfers to the initial and terminal audit facts.
 const archivePage=door.action==='archive.export'&&request.headers.get(archiveProgressHeader)==='2'&&
  ['capture','schema','rows'].includes(new URL(request.url).searchParams.get('archive')??'');
 const page=archivePage?await next():undefined;
 if(page?.ok)return page;
 const identity=await requestIdentity(request,env,door.action==='capture.native'||door.action==='capture.exposure',work);
 // A request no session or credential admitted only reads the alias of the object it names;
 // the binding waits for its handler to admit it, so refused guesses leave no durable mapping.
 const binding=subjectBinding(door.kind,door.project?JSON.stringify([door.project,door.subject]):door.subject,door.project);
 let actor:AuditActor, bound:string|undefined, projectLabel:string|null;
 if(identity&&door.project){
  ({actor,bound,projectLabel}=work
   ? await work.bindAliases(identity,binding,door.project)
   : await bindRequestAliases(env.DB,identity,binding,door.project));
 } else {
  actor=identity?await auditActor(env.DB,identity):unidentifiedActor();
  [bound,projectLabel]=await Promise.all([
   unverified(actor)?boundAuditLabel(env.DB,binding):auditLabel(env.DB,binding),
   door.project?projectAuditLabel(env.DB,door.project):null,
  ]);
 }
 const subject={kind:door.kind,label:bound??randomAuditLabel()};
 let scope: AuditScope={actor,action:door.action,subject,projectLabel};
 const observe=async(status:number)=>{
  const fact: AuditFact={source:'request',actor:scope.actor,action:door.action,subject,projectLabel,outcome:responseOutcome(status),status};
  if(work)await work.observe(fact);
  else await recordAudit(env.DB,fact);
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
