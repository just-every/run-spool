import { canonicalJson, utf8 } from './hash.mjs';

const table='rer_portability_object_inventory';
const chunkSize=50;
export async function ensureObjectInventory(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${table}(job TEXT NOT NULL REFERENCES rer_portability_jobs(id) ON DELETE CASCADE, chunk INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(job,chunk))`).run();
}
// Keep large manifests out of D1's per-value and per-row limits. Only the
// storage representation changes; archive manifests still contain every object.
export function prepareInventory(row) {
  if(utf8(canonicalJson(row.metadata.manifest.objects)).length>256*1024)
    row.metadata.objectInventory=Math.ceil(row.metadata.manifest.objects.length/chunkSize);
}
export function metadataJson(metadata) {
  if(!metadata.objectInventory)return canonicalJson(metadata);
  const compact={...metadata,manifest:{...metadata.manifest,objects:[]}};
  if(metadata.restoreManifest)compact.restoreManifest={...metadata.restoreManifest,objects:[]};
  return canonicalJson(compact);
}
export function inventoryStatements(db,row,start=0,end=row.metadata.manifest.objects.length) {
  if(!row.metadata.objectInventory)return [];
  const objects=row.metadata.manifest.objects,statements=[];
  for(let chunk=Math.floor(start/chunkSize);chunk<Math.ceil(end/chunkSize);chunk++)
    statements.push(db.prepare(`INSERT OR REPLACE INTO ${table}(job,chunk,data) VALUES(?,?,?)`).bind(row.id,chunk,canonicalJson(objects.slice(chunk*chunkSize,(chunk+1)*chunkSize))));
  return statements;
}
export async function loadInventory(db,row) {
  if(!row.metadata.objectInventory)return row;
  const objects=[];
  // Read bounded pages: a complete inventory can exceed the RPC result limit.
  for(let offset=0;offset<row.metadata.objectInventory;offset+=16) {
    const {results}=await db.prepare(`SELECT data FROM ${table} WHERE job=? ORDER BY chunk LIMIT 16 OFFSET ?`).bind(row.id,offset).all();
    for(const item of results)objects.push(...JSON.parse(item.data));
  }
  row.metadata.manifest.objects=objects;
  if(row.metadata.restoreManifest)row.metadata.restoreManifest.objects=objects;
  return row;
}
export function clearInventory(db,row) {
  if(!row.metadata.objectInventory)return [];
  delete row.metadata.objectInventory;
  row.metadata.manifest.objects=[];
  if(row.metadata.restoreManifest)row.metadata.restoreManifest.objects=[];
  return [db.prepare(`DELETE FROM ${table} WHERE job=?`).bind(row.id)];
}
