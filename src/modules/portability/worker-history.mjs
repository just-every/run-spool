import { policy, inventorySchemaIdentity } from './catalogue.mjs';
import { canonicalJson } from './hash.mjs';
import { checkoutHistory } from './checkout-history.mjs';
import { insist, PortabilityError } from './storage.mjs';

// This adapter supplies replay evidence, never archive validation. The same
// collector, ledger matching, schema bridge and restore guards serve both doors.
export async function workerMigrations(db,input,evidence) {
 try {
  insist(evidence?.version===1 && evidence.prefixes.length===evidence.files.length+1,'schema_mismatch:legacy_evidence',409);
  const config=policy(input),files=evidence.files;
  return await checkoutHistory(db,input,files,names=>{
   const prefix=selected=>{
    insist(selected.length<=names.length && canonicalJson(selected)===canonicalJson(files.slice(0,selected.length).map(f=>f.name)),'schema_mismatch:legacy_evidence',409);
    const found=evidence.prefixes[selected.length];
    insist(found,'schema_mismatch:legacy_evidence',409);return found;
   };
   const final=prefix(names);
   return {names,statements:name=>files.find(f=>f.name===name)?.statements,sha256:name=>files.find(f=>f.name===name)?.sha256,
    schemaAfter(selected,options){
     const snapshot=prefix(selected);
     return inventorySchemaIdentity({objects:snapshot.objects.map(i=>evidence.objects[i]),kinds:snapshot.shadows.map(name=>({name,type:'shadow'}))},config,options);
    },
    async rowImages(requests){return new Map(requests.filter(r=>final.seeds.some(s=>s.name===r.name && !s.hashes.length)).map(r=>[r.name,[]]));},
    async rowHashes(requests,limit){return new Map(requests.flatMap(r=>{const found=final.seeds.find(s=>s.name===r.name && s.hashes.length<=limit && canonicalJson(s.columns)===canonicalJson(r.columns));return found?[[r.name,found.hashes]]:[];}));},
   };
  });
 }catch(error){if(error instanceof PortabilityError)throw error;throw new PortabilityError('schema_mismatch:legacy_evidence',409);}
}
