import { WorkerEntrypoint } from 'cloudflare:workers';
import { Context } from 'hono';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';
import { runAuditScope, type AuditScope } from './domain/audit/context';
import { bindRequestAliases, type BindRequestAliases } from './domain/audit/request';
import { nativeAdmission, normalizeCapture, type IngestEnv, type NativeCaptureInput } from './domain/ingest-api';
import { apiError } from './domain/api-middleware';
import type { IngestScope } from './domain/admission';
import { prepareCapture, type CapturePlan } from './domain/capture-evidence';
import type { Envelope } from './domain/privacy';

// Hosted capture uses the same scope as its request audit. Admission still
// checks the exact project key and writes its transaction fact with the event.
export class SpoolCapture extends WorkerEntrypoint<Bindings & AlertEnvironment, {audit:AuditScope}> {
 bindAliases(...args:Parameters<BindRequestAliases>) {
  return bindRequestAliases(this.env.DB,...args);
 }
 async capture(input: NativeCaptureInput, grant: IngestScope): Promise<{body:string|null;status:number;headers:Record<string,string>;alertId:string|undefined}> {
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
  const request=new Request(input.url,{method:'POST',headers:input.headers});
  const context=new Context<IngestEnv>(request,{env,executionCtx:this.ctx,path:new URL(input.url).pathname});
  if(grant.domain.cors)context.header('Access-Control-Allow-Origin',grant.domain.cors);
  const response=await runAuditScope(scope,async()=>{
   try { return await nativeAdmission(context,grant,input.text); }
   catch(error) { if(error instanceof Error)return apiError(error,context);throw error; }
  });
  return {
   body: response.body===null ? null : await response.text(),
   status: response.status,
   headers: Object.fromEntries(response.headers),
   alertId,
  };
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
