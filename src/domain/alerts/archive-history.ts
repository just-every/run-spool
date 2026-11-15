import { PortabilityError,canonicalJson } from '../../modules/portability/index.mjs';
import { archivedHistory,matchMigrationLedger,checkArchivedLedgers } from '../../modules/portability/ledgers.mjs';
import { libraryMigrations } from '../../modules/portability/library-history.mjs';
import { restorableManifest } from '../../modules/portability/bookkeeping.mjs';
import { ArchiveVerifier } from '../../modules/portability/format.mjs';
import { catalogue,policy } from '../../modules/portability/catalogue.mjs';
// A native schema translation must not turn an unverified legacy ledger into
// current authority. Replay only destination-owned history, never archive SQL.
export async function verifyTranslatedHistory(service:any,manifest:any,ledgers:any){
 const source=await restorableManifest(manifest),hasHistory=Object.keys(ledgers).length||manifest.migrationLedger||manifest.migrations?.length;
 if(!hasHistory&&manifest.schemaObjects!==undefined)return;
 checkArchivedLedgers(manifest,ledgers);
 const history=archivedHistory(manifest,ledgers),config=policy(service.inputPolicy),factory=service.migrationProvider?()=>service.migrationProvider(service.db,config):await libraryMigrations(service.db,config);
 if(!history?.length&&manifest.schemaObjects===undefined)throw new PortabilityError('schema_mismatch:legacy_schema',409);
 if(manifest.schemaObjects===undefined&&history.some((entry:any)=>!entry.sha256))throw new PortabilityError('schema_mismatch:legacy_schema',409);
 const replay=await factory(),files=replay.names.map((name:string)=>({name,sha256:replay.sha256?.(name),aliases:replay.aliases?.(name)}));
 const recorded=matchMigrationLedger(history??manifest.migrations.map((name:string)=>({name})),files,replay);
 if(canonicalJson(recorded)!==canonicalJson(replay.names.slice(0,recorded.length)))throw new PortabilityError('schema_mismatch:migration_history',409);
 const historical=await replay.schemaAfter(recorded,manifest.schemaObjects===undefined?{tablesOnly:true}:undefined);
 const current=await catalogue(service.db,config);
 if(historical!==source.schema||await replay.schemaAfter(replay.names)!==current.identity)throw new PortabilityError('schema_mismatch:legacy_schema',409);
}

// Previous native archives can contain entire bookkeeping-only parts. Repack
// their verified projection before opening Base's ordinary atomic restore.
export async function restoreTranslatedProjection(service:any,original:any,manifest:any,parts:any[],ledgers:any,laterJournal?:unknown){
 await verifyTranslatedHistory(service,original,ledgers);
 manifest={...manifest,partCount:parts.length};
 const binding=new ArchiveVerifier(manifest);for(const part of parts)binding.add(part);
 let id:string|undefined,complete=false;
 try{
  id=await service.imports.create(manifest);
  for(const part of parts)await service.imports.uploadPart(id,part.index,part);
  await service.imports.finalize(id,{archiveHash:binding.digest(),...(laterJournal?{laterJournal}:{})});complete=true;
 }finally{if(id&&!complete)await service.imports.abort(id)}
}
