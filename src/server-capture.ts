import { WorkerEntrypoint } from 'cloudflare:workers';
import { runtimeBindings, type Bindings } from './auth/bindings';
import type { AlertEnvironment } from './domain/alerts/types';
import { runAuditScope, type AuditScope } from './domain/audit/context';
import { ingestApi } from './domain/ingest-api';

// Hosted capture uses the same scope as its request audit. Admission still
// checks the exact project key and writes its transaction fact with the event.
export class SpoolCapture extends WorkerEntrypoint<Bindings & AlertEnvironment, {audit:AuditScope}> {
 fetch(request: Request) {
  const scope=this.ctx.props.audit;
  if (!scope) throw new Error('capture_audit_required');
  return runAuditScope(scope,async()=>ingestApi.fetch(request,runtimeBindings(this.env),this.ctx));
 }
}
