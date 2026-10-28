import type { Bindings } from '../../auth/bindings';
import type { OwnerSession } from '../owner-authority';
import type { D1ImportContext } from '../../modules/import-kit/src/d1/index.ts';
import { mappingVersion } from './source';
import { sentryTargets } from './targets';

export function ownerImportPredicate(session: OwnerSession) {
 if(session.kind==='agent')return {sql:'0',params:[]};
 return {sql: `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
  WHERE s.id=? AND o.id=? AND o.version=? AND s.operator_version=o.version
  AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
  AND o.status='active' AND o.role='owner')`, params:[session.id,session.operator.id,session.operator.version]};
}
export function ownerImportContext(env: Bindings, session: OwnerSession, namespace: string): D1ImportContext {
 return {destination:'spool-owner',namespace,mappingVersion,batchSize:10,maxBatches:1,
  storage:{database:env.DB,targets:sentryTargets},
  authorization:{principalId:session.operator.id,predicate:()=>ownerImportPredicate(session)}};
}
