import { all,statement,guard,quote,insist } from './storage.mjs';
import { canonicalJson, sha256 } from './hash.mjs';
const identifier=value=>value.replace(/[A-Z]/g,c=>c.toLowerCase());

export async function excludedDependentGuards(db,targets,replaceable) {
  if(!replaceable.length)return [];
  const tables=await all(db,"SELECT name,sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name"),references=[];
  // REFERENCES is required in every FK declaration. Tables without that keyword have no
  // FKs, including D1's protected metadata tables which refuse PRAGMA inspection.
  for(const table of tables.filter(t=>/\bREFERENCES\b/i.test(t.sql)))for(const fk of await all(db,`PRAGMA foreign_key_list(${quote(table.name)})`)) {
    const parent=tables.find(t=>identifier(t.name)===identifier(fk.table))?.name??fk.table;
    if([fk.on_delete,fk.on_update].some(action=>['CASCADE','SET NULL','SET DEFAULT'].includes(action)))references.push({child:table.name,parent});
  }
  const affected=new Set(replaceable),protectedTables=new Map();
  let changed=true;
  while(changed) {
    changed=false;
    for(const {child,parent} of references)if(affected.has(parent)) {
      if(!targets.some(t=>t.name===child))protectedTables.set(child,parent);
      if(!affected.has(child)){affected.add(child);changed=true;}
    }
  }
  const guards=[];
  for(const [child,parent] of protectedTables) {
    // Conservatively refuse populated excluded dependents, including transitive actions.
    // Repeat this condition inside the atomic commit to catch rows added after validation.
    insist(!(await statement(db,`SELECT 1 FROM ${quote(child)} LIMIT 1`).first()),'excluded_destination_dependents:'+child+':'+parent,409);
    guards.push(guard(db,`NOT EXISTS(SELECT 1 FROM ${quote(child)})`));
  }
  return guards;
}
const imageSql=(table,columns)=>`SELECT json_array(${columns.map(c=>`quote(${quote(c)})`).join(',')}) AS image FROM ${quote(table)}`;
const MAX_SEED_ROWS=10000;

/** Of the filled tables `names`, those holding exactly the rows the replay of the destination's
 * applied migrations (migrations(), a node runner's scratch database) leaves there: the settings
 * and other rows a fresh installation's own migrations seed. Without a usable replay none is. */
export async function migrationSeeded(db,names,migrations) {
 if(!names.length || !migrations)return [];
 const requests=[];
 for(const name of names)requests.push({name,columns:(await all(db,`SELECT name FROM pragma_table_info(?)`,name)).map(c=>c.name)});
 // Without a usable replay no seed is vouched for, so those rows count as the installation's own.
 const replay=await migrations().catch(()=>null);
 const hashed=Boolean(replay?.rowHashes);
 const expected=replay?await (hashed?replay.rowHashes(requests,MAX_SEED_ROWS):replay.rowImages(requests,MAX_SEED_ROWS)):new Map(),seeded=[];
 for(const {name,columns} of requests) {
  const want=expected.get(name);
  if(!want || (await statement(db,`SELECT count(*) AS n FROM ${quote(name)}`).first()).n!==want.length)continue;
  const found=(await all(db,imageSql(name,columns))).map(r=>r.image).sort();
  const identities=hashed?(await Promise.all(found.map(sha256))).sort():found;
  if(canonicalJson(identities)===canonicalJson(want))seeded.push({name,columns,images:found});
 }
 return seeded;
}
/** The SQL condition (with its values) that `table` still holds exactly its seeded rows. */
export const seededCondition=table=>[`(SELECT count(*) FROM ${quote(table.name)})=? AND NOT EXISTS(SELECT 1 FROM (${imageSql(table.name,table.columns)}) WHERE image NOT IN (SELECT value FROM json_each(?)))`,table.images.length,JSON.stringify(table.images)];
