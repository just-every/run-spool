import { inventorySchemaIdentity } from './catalogue.mjs';
import { canonicalJson } from './hash.mjs';
import { checkoutHistory } from './checkout-history.mjs';
import { insist, PortabilityError } from './storage.mjs';

function bundledSnapshots(evidence,names) {
 insist(evidence.prefixes.length===evidence.files.length+1
  && names.every((name,i)=>name===evidence.files[i]?.name),'schema_mismatch:legacy_evidence',409);
 return {
  inventory(index){
   const snapshot=evidence.prefixes[index];
   return {objects:snapshot.objects.map(i=>evidence.objects[i]),kinds:snapshot.shadows.map(name=>({name,type:'shadow'}))};
  },
  seeds:evidence.prefixes[names.length].seeds,
 };
}

// This adapter supplies replay evidence, never archive validation. The same
// collector, ledger matching, schema bridge and restore guards serve both doors.
export async function workerMigrations(db,input,evidence) {
 try {
  insist(evidence?.version===1 || evidence?.version===2 && evidence.ownerSources?.length
   && typeof evidence.snapshots==='function' && typeof evidence.nativePrefix==='function','schema_mismatch:legacy_evidence',409);
  const {files,ownerSources}=evidence;
  return await checkoutHistory(db,input,files,async (names,config)=>{
   const {inventory,seeds,replayInventory}=evidence.version===2?await evidence.snapshots(names):bundledSnapshots(evidence,names);
   return {names,statements:name=>files.find(file=>file.name===name)?.statements,sha256:name=>files.find(file=>file.name===name)?.sha256,
    async schemaAfter(selected,options,allowSubsequence){
     if(selected.length<=names.length && selected.every((name,i)=>name===names[i]))return inventorySchemaIdentity(inventory(selected.length),config,options);
     insist(allowSubsequence && replayInventory,'schema_mismatch:legacy_evidence',409);
     return inventorySchemaIdentity(await replayInventory(selected),config,options);
    },
    async rowImages(requests){return new Map(requests.filter(r=>seeds.some(s=>s.name===r.name && !s.hashes.length)).map(r=>[r.name,[]]));},
    async rowHashes(requests,limit){return new Map(requests.flatMap(r=>{const found=seeds.find(s=>s.name===r.name && s.hashes.length<=limit && canonicalJson(s.columns)===canonicalJson(r.columns));return found?[[r.name,found.hashes]]:[];}));},
   };
  },{nativeWrangler:true,ownerSources,nativePrefix:evidence.nativePrefix});
 }catch(error){if(error instanceof PortabilityError)throw error;throw new PortabilityError('schema_mismatch:legacy_evidence',409);}
}
