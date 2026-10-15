import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {legacyMailRows} from '../legacy-mail.mjs';

// Every table and every column of the local D1 file, read-only, as text and as
// bytes. Returns each needle found with its table and column.
export function scanDatabase(root,needles){
 const directory=resolve(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
 const found=[];let tables=0,cells=0;
 for(const file of readdirSync(directory).filter(name=>name.endsWith('.sqlite'))){
  const db=new DatabaseSync(resolve(directory,file),{readOnly:true});
  try{
   for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()){
    tables++;
    const columns=db.prepare(`PRAGMA table_xinfo("${name.replaceAll('"','""')}")`).all().map(column=>column.name);
    for(const row of db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}"`).all())for(const column of columns){
     const value=row[column];if(value===null||value===undefined)continue;cells++;
     const text=value instanceof Uint8Array?Buffer.from(value).toString('utf8'):String(value);
     for(const needle of needles)if(text.includes(needle)||text.toLowerCase().includes(needle.toLowerCase()))found.push({table:name,column,needle});
    }
   }
  }finally{db.close();}
 }
 return {tables,cells,found};
}
export async function scanOutbox(app,needles){
 const rows=await legacyMailRows(app.origin),found=[];
 for(const row of rows)for(const needle of needles)if(row.message.toLowerCase().includes(needle.toLowerCase()))found.push({message:row.id,needle});
 return {messages:rows.length,found};
}
export const scanText=(text,needles)=>needles.filter(needle=>text.toLowerCase().includes(needle.toLowerCase()));

// Surviving project audit rows carry kind, time and a random label only; the
// label appears nowhere but the receipt, and no row names an erased project.
export function auditReport(root,{erased,expected}){
 const directory=resolve(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
 for(const file of readdirSync(directory).filter(name=>name.endsWith('.sqlite'))){
  const db=new DatabaseSync(resolve(directory,file),{readOnly:true});
  try{
   if(!db.prepare("SELECT 1 FROM sqlite_master WHERE name='audit'").get())continue;
   const labelled=db.prepare("SELECT kind,detail,created FROM audit WHERE project IS NULL AND detail LIKE '{\"erasure\":%'").all();
   const labels=[...new Set(labelled.map(row=>JSON.parse(row.detail).erasure))];
   assert.ok(labels.every(label=>/^erased:[0-9a-f]{32}$/.test(label)),'every surviving audit label is a random erasure label');
   const receipts=db.prepare('SELECT label,subject FROM rer_erasure_operations').all();
   assert.ok(receipts.every(row=>row.subject===null),'completed receipts hold no subject');
   assert.deepEqual(labels.sort(),receipts.map(row=>row.label).filter(label=>labels.includes(label)).sort(),'labels match only receipts');
   for(const project of erased)assert.equal(db.prepare('SELECT count(*) n FROM audit WHERE project=?').get(project).n,0,'no audit row names an erased project');
   const counts=Object.fromEntries(labels.map(label=>[label,labelled.filter(row=>JSON.parse(row.detail).erasure===label).length]));
   assert.deepEqual(Object.values(counts).sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b),'each erased project keeps exactly its audit rows, anonymised');
   return {labels:labels.length,rows:labelled.length,kinds:[...new Set(labelled.map(row=>row.kind))].sort(),counts:Object.values(counts)};
  }finally{db.close();}
 }
 throw new Error('No local D1 database with an audit table');
}
