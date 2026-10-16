import { createImportDoorHandler } from '../../modules/import-kit/src/door/index.ts';
import type { ImportMapping, SourceBundle } from '../../modules/import-kit/src/types.ts';
import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
import { ownerClaimConfig } from '../../editor/owner-claim-config.server';
import type { ManagedBindings } from '../../editor/bindings';
import { parseSentryOrganization, mappingVersion } from './source';
import { organizationMapping } from './mapping';
import { sentryTargets } from './targets';

export async function businessImportResponse(request: Request, env: ManagedBindings) {
 if (!new URL(request.url).pathname.startsWith('/api/rer/import/')) return null;
 let claim;
 try { claim = ownerClaimConfig(env); } catch { return Response.json({error:'not_found'},{status:404}); }
 const owner = await env.DB.prepare("SELECT id FROM oa_operators WHERE role='owner' AND status='active' AND email=?").bind(claim.expectedEmail).first<{id:string}>();
 if (!owner) return Response.json({error:'not_found'},{status:404});
 // Request-local mapping state: the same whole-bundle parser and pure native
 // mapping as the owner's importer, with stable occurrence IDs for this bundle.
 let mapping: ImportMapping | undefined;
 return createImportDoorHandler({database:env.DB,targets:sentryTargets,claim,
  ownerPrincipalId:owner.id,destination:'spool-owner',format:'json',
  limits:{maxBytes:2*1024*1024,maxRecordBytes:2*1024*1024,maxRecords:500},
  parse(value,index) {
   if (index !== 0 || mapping) throw new Error('One Sentry organization bundle required');
   const records = parseSentryOrganization(value);
   mapping = organizationMapping({records} as SourceBundle,'business:'+sha256(canonicalJson(value)));
   return records;
  },
  mapping:{version:mappingVersion,map(record) {
   if (!mapping) throw new Error('Sentry bundle required');
   return mapping.map(record);
  }},
 })(request);
}
