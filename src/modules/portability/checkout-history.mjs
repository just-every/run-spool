import { catalogue, policy } from './catalogue.mjs';
import { destinationLedger, matchMigrationLedger } from './ledgers.mjs';
import { insist } from './storage.mjs';

// Both evidence adapters bind the seed's files to the live hashed history and
// complete schema before the shared legacy collector can accept an upload.
export async function checkoutHistory(db,input,files,replayFor) {
 const ledger=await destinationLedger(db)??[];
 insist(ledger.length && ledger.every(row=>row.sha256),'schema_mismatch:legacy_evidence',409);
 const applied=matchMigrationLedger(ledger,files);
 const replay=await replayFor(applied);
 insist(await replay.schemaAfter(replay.names)===(await catalogue(db,policy(input))).identity,'schema_mismatch');
 return replay;
}
