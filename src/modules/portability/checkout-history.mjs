import { catalogue, policy } from './catalogue.mjs';
import { readLedger, matchMigrationLedger } from './ledgers.mjs';
import { nativeMigrationHistory, ownerMigrationPolicy } from './owner-history.mjs';
import { insist } from './storage.mjs';

function bundledPrefix(history,files) {
 return history.entries.every((row,i)=>row.name===files[i]?.name && (history.owners || row.sha256===undefined));
}

// Both evidence adapters bind the seed's files to live history and the complete
// schema. Plain Wrangler history must select a literal ordered prefix within
// each ledger. The merged chronology chooses how those prefixes are replayed.
export async function checkoutHistory(db,input,files,replayFor,{nativeWrangler=false,ownerSources=[],nativePrefix=bundledPrefix}={}) {
 const history=await (ownerSources.length?nativeMigrationHistory(db,ownerSources):readLedger(db)),ledger=history?.entries??[];
 insist(ledger.length,'schema_mismatch:legacy_evidence',409);
 if(!ledger.every(row=>row.sha256)) {
  insist(nativeWrangler && history.table==='d1_migrations' && nativePrefix(history,files),
   'schema_mismatch:legacy_evidence',409);
 }
 const applied=matchMigrationLedger(ledger,files);
 const config=policy(ownerMigrationPolicy(input,ownerSources)),replay=await replayFor(applied,config);
 insist(await replay.schemaAfter(replay.names)===(await catalogue(db,config)).identity,'schema_mismatch');
 return ownerSources.length?{...replay,ownerSources,history}:replay;
}
