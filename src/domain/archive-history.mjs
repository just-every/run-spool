import history from './archive-history.json' with {type:'json'};
import {destinationLedger,matchMigrationLedger} from '../modules/portability/ledgers.mjs';

// Trusted, build-time replay of this installation's migration files. Workers do
// not execute archive SQL or infer behavioral objects from a table checksum.
export function archiveHistory(db){return async()=>{
 const ledger=await destinationLedger(db);
 if(!ledger)throw Error('Archive migration history is unavailable');
 const names=matchMigrationLedger(ledger,history.migrations);
 const last=history.prefixes.find(prefix=>JSON.stringify(prefix.names)===JSON.stringify(names));
 if(!last)throw Error('Archive migration history is not a recorded prefix');
 const migrations=history.migrations.filter(migration=>names.includes(migration.name));
 return {names,statements:name=>migrations.find(m=>m.name===name)?.statements,
  sha256:name=>migrations.find(m=>m.name===name)?.sha256,
  async schemaAfter(requested,options={}){
   const prefix=history.prefixes.find(p=>JSON.stringify(p.names)===JSON.stringify(requested));
   if(!prefix||requested.some(name=>!names.includes(name)))throw Error('Archive migration history is not a recorded prefix');
   return options.tablesOnly?prefix.tablesOnly:options.legacyExcludedObjects?prefix.legacyExcludedObjects:prefix.identity;
  },
  async rowImages(requests,limit){return new Map(requests.flatMap(({name,columns})=>{
   const seed=last.seeds.find(seed=>seed.name===name&&JSON.stringify(seed.columns)===JSON.stringify(columns));
   return seed&&seed.images.length<=limit?[[name,seed.images]]:[];
  }));},
 };
};}
