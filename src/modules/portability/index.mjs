import { ensureImportLeases } from './import-lease.mjs';
import { policy, catalogue } from './catalogue.mjs';
import { wireDatabase } from '../d1-transport/index.mjs';
import { insist, job } from './storage.mjs';
import { createExport, advanceExport, exportStatus, downloadExport, abortExport } from './export.mjs';
import { libraryImports, createImport, uploadPart, finalizeImport, importStatus, activeImport, abortImport, abortAbandonedImport } from './import.mjs';
import { erasureStatements, redactionStatements, invalidateTransfersStatements } from './journal.mjs';
export { archiveLines } from './lines.mjs';
export { excludedTables, excludedTable } from './catalogue.mjs';
export { readArchive, makePart, MAX_LINE_BYTES, MAX_PART_BYTES } from './format.mjs';
export { canonicalJson, sha256 } from './hash.mjs';
export { PortabilityError } from './storage.mjs';
export { createPortabilityHandler } from './http.mjs';
export async function createPortability({db,buckets={},policy:input,migrations,onExport,migrationRoot}) {
  insist(onExport===undefined || typeof onExport==='function','invalid_on_export');
  db=wireDatabase(db);
  const config=policy(input);await catalogue(db,config);
  for(const name of Object.keys(config.buckets))insist(buckets[name] && typeof buckets[name].get==='function','missing_bucket:'+name);
  await ensureImportLeases(db);
  const context={db,buckets,config,migrations,onExport};
  const importContext={...context,inputPolicy:input};
  const {lookup,actor,...imports}=libraryImports(importContext,{
    active:actor=>activeImport(importContext,actor),
    create:(manifest,actor,options={})=>createImport(importContext,manifest,actor,undefined,options.ledgers,options.acknowledgeUnverifiedSchemaObjects,options.id),
    uploadPart:(id,index,part)=>uploadPart(importContext,id,index,part),
    finalize:(id,options)=>finalizeImport(importContext,id,options),
    status:id=>importStatus(importContext,id),abort:id=>abortImport(importContext,id),
    abortAbandoned:()=>abortAbandonedImport(importContext),
    lookup:async id=>(await job(db,id)).kind==='export'?exportStatus(context,id):importStatus(importContext,id),
    actor:id=>job(db,id).then(row=>row.actor),
  },migrationRoot);
  return {
    exports:{create:actor=>createExport(context,actor),advance:(id,options)=>advanceExport(context,id,options),status:id=>exportStatus(context,id),download:id=>downloadExport(context,id),abort:id=>abortExport(context,id)},
    imports,
    status:lookup,
    actor,
    erasureStatements:(table,key)=>erasureStatements(db,table,key),redactionStatements:()=>redactionStatements(db),invalidateTransfersStatements:()=>invalidateTransfersStatements(db),
  };
}
