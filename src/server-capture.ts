import { WorkerEntrypoint } from 'cloudflare:workers';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';
import { runAuditScope, type AuditScope } from './domain/audit/context';
import { ingestApi } from './domain/ingest-api';
import { captureEvidence, type CaptureEvidence } from './domain/capture-evidence';
import type { Envelope } from './domain/privacy';

// Hosted capture uses the same scope as its request audit. Admission still
// checks the exact project key and writes its transaction fact with the event.
export class SpoolCapture extends WorkerEntrypoint<Bindings & AlertEnvironment, {audit:AuditScope}> {
 async capture(request: Request): Promise<{body:string|null;status:number;headers:Record<string,string>;alertId:string|undefined}> {
  const scope=this.ctx.props.audit;
  if (!scope) throw new Error('capture_audit_required');
  let alertId: string | undefined;
  const work=(this.ctx.exports as unknown as {SpoolCapture:Pick<SpoolCapture,'evidence'>}).SpoolCapture;
  const env={
   ...runtimeBindings(this.env),
   readEvidence: (project:string,event:Envelope) => work.evidence(project,event),
   onAlertAdmitted: (id:string) => {alertId=id;},
  };
  const response=await runAuditScope(scope,async()=>ingestApi.fetch(request,env,this.ctx));
  return {
   body: response.body===null ? null : await response.text(),
   status: response.status,
   headers: Object.fromEntries(response.headers),
   alertId,
  };
 }
 evidence(project: string, event: Envelope): Promise<CaptureEvidence> {
  return captureEvidence(this.env.DB,project,event);
 }
}
