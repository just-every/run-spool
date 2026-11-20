import { migrationRecorder } from './migration-evidence.mjs';

function nativePrefix(history,files) {
 if(!history.owners)return history.entries.every((row,i)=>
  row.sha256===undefined && row.name===files[i]?.name && files[i].table===undefined);
 const byTable=new Map();
 for(const file of files) {
  const table=file.table??history.table;
  if(!byTable.has(table))byTable.set(table,[]);
  byTable.get(table).push(file.name);
 }
 const offsets=new Map();
 return history.entries.every(({name,table})=>{
  const offset=offsets.get(table)??0;
  offsets.set(table,offset+1);
  return name===byTable.get(table)?.[offset];
 });
}

// Only the build evidence for a checkout with owner SQL links this module.
export function workerOwnerEvidence(evidence,openDatabase) {
 const files=new Map(evidence.files.map(file=>[file.name,file]));
 return {
  ...evidence,
  nativePrefix,
  async snapshots(names) {
   const scratch=await openDatabase();
   try {
    const recorder=migrationRecorder(scratch),prefixes=[recorder.inventory()];
    for(const name of names) {
     recorder.apply(files.get(name));
     prefixes.push(recorder.inventory());
    }
    return {inventory:index=>prefixes[index],seeds:await recorder.seeds(prefixes.at(-1).objects)};
   }finally{scratch.close();}
  },
 };
}
