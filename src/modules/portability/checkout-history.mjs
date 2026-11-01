import { catalogue, policy } from './catalogue.mjs';
import { readLedger, matchMigrationLedger } from './ledgers.mjs';
import { insist } from './storage.mjs';

// Both evidence adapters bind the seed's files to live history and the complete
// schema. Only an explicitly bundled Worker may bind plain Wrangler history:
// literal names must select an ordered checkout prefix, never aliases or gaps.
export async function checkoutHistory(db,input,files,replayFor,{nativeWrangler=false}={}) {
 const history=await readLedger(db),ledger=history?.entries??[];
 insist(ledger.length,'schema_mismatch:legacy_evidence',409);
 if(!ledger.every(row=>row.sha256)) {
  insist(nativeWrangler && history.table==='d1_migrations'
   && ledger.every((row,i)=>row.sha256===undefined && row.name===files[i]?.name),
   'schema_mismatch:legacy_evidence',409);
 }
 const applied=matchMigrationLedger(ledger,files);
 const replay=await replayFor(applied);
 insist(await replay.schemaAfter(replay.names)===(await catalogue(db,policy(input))).identity,'schema_mismatch');
 return replay;
}
