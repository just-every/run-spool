import { WorkerEntrypoint } from 'cloudflare:workers';
import { Context } from 'hono';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';
import { runAuditScope, type AuditScope } from './domain/audit/context';
import { bindRequestAliases, lookupRequestCredential, type BindRequestAliases } from './domain/audit/request';
import { hostedMintAdmission } from './domain/dev-credentials';
import { recordAudit } from './domain/audit/record';
import type { AuditFact } from './domain/audit/types';
import { nativeAdmission, normalizeCapture, type AuthorizeNative, type IngestEnv, type NativeCaptureInput, type NativeCaptureMetadata, type NativeResponse } from './domain/ingest-api';
import { apiError } from './domain/api-middleware';
import { authorizeIngestDigest, type IngestScope } from './domain/admission';
import { prepareCapture, type CapturePlan } from './domain/capture-evidence';
import type { Envelope } from './domain/privacy';

function captureContext(input:NativeCaptureMetadata,env:IngestEnv['Bindings'],ctx:ExecutionContext) {
 const request=new Request(input.url,{method:'POST',headers:input.headers});
 return new Context<IngestEnv>(request,{env,executionCtx:ctx,path:new URL(input.url).pathname});
}
async function captureResponse(response:Response):Promise<NativeResponse> {
 return {body:response.body===null?null:await response.text(),status:response.status,headers:Object.fromEntries(response.headers)};
}

// Hosted capture uses the same scope as its request audit. Admission still
// checks the exact project key and writes its transaction fact with the event.
export class SpoolCapture extends WorkerEntrypoint<Bindings & AlertEnvironment, {audit:AuditScope}> {
 // The hosted request has no local minting gate. Keep the live credential
 // lookup and D1 serialization out of the public intake invocation.
 auditCredential(digest:string) {
  return lookupRequestCredential(this.env.DB,digest,hostedMintAdmission);
 }
 bindAliases(...args:Parameters<BindRequestAliases>) {
  return bindRequestAliases(this.env.DB,...args);
 }
 observe(fact:AuditFact) {
  return recordAudit(this.env.DB,fact);
 }
 async authorize(input:NativeCaptureMetadata,project:string,keyHash:string):ReturnType<AuthorizeNative> {
  const scope=this.ctx.props.audit;
  if(!scope)throw new Error('capture_audit_required');
  const context=captureContext(input,runtimeBindings(this.env),this.ctx);
  return runAuditScope(scope,async()=>{
   try {
    const result=await authorizeIngestDigest(context,project,async()=>keyHash);
    return 'response' in result?{refusal:await captureResponse(result.response),drain:true}:result;
   } catch(error) {
    if(error instanceof Error)return {refusal:await captureResponse(apiError(error,context)),drain:false};
    throw error;
   }
  });
 }
 async capture(input: NativeCaptureInput, grant: IngestScope): Promise<NativeResponse & {alertId:string|undefined}> {
  const scope=this.ctx.props.audit;
  if (!scope) throw new Error('capture_audit_required');
  let alertId: string | undefined;
  const work=(this.ctx.exports as unknown as {SpoolCapture:{
   normalize(document:unknown):Promise<Envelope & Disposable>;
   plan(project:string,event:Envelope):Promise<CapturePlan & Disposable>;
  }}).SpoolCapture;
  const env={
   ...runtimeBindings(this.env),
   async normalizeCapture(document:unknown) {
    using result=await work.normalize(document);
    return {...result};
   },
   async planCapture(project:string,event:Envelope) {
    using result=await work.plan(project,event);
    return {...result};
   },
   onAlertAdmitted: (id:string) => {alertId=id;},
  };
  const context=captureContext(input,env,this.ctx);
  if(grant.domain.cors)context.header('Access-Control-Allow-Origin',grant.domain.cors);
  const response=await runAuditScope(scope,async()=>{
   try { return await nativeAdmission(context,grant,input.text); }
   catch(error) { if(error instanceof Error)return apiError(error,context);throw error; }
  });
  return {...await captureResponse(response),alertId};
 }
 normalize(document: unknown): Envelope {
  return normalizeCapture(document);
 }
 async plan(project: string, event: Envelope): Promise<CapturePlan> {
  const prepared=await prepareCapture(this.env.DB,project,event,false);
  if('refusal' in prepared)return prepared;
  const {jobs, ...plan}=prepared;
  return plan;
 }
}
