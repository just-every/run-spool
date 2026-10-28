import { all, quote, insist } from './storage.mjs';
// A referenced key stays in its bucket's namespace however a reader joins or
// resolves it: nonempty, under the declared prefix, not absolute and with no
// '.' or '..' segment.
const namespaced=(prefix,key)=>typeof key==='string' && key!=='' && key.startsWith(prefix) && !/^[\\/]/.test(key) && !key.split(/[\\/]/).some(part=>part==='.' || part==='..');
// Export checks its snapshot and restore its staged rows, before any object
// write: for every bucket that declares references, the distinct referenced keys
// lie in its namespace and are exactly its archived objects, none missing and
// none extra. A table restored across a later ADD COLUMN stages only archived
// columns; publication gives its rows the destination's default there.
export async function checkReferences({db,config},copies,objects) {
  for(const [binding,spec] of Object.entries(config.buckets)) if(spec.objectReferences) {
    const {table,keyColumn}=spec.objectReferences,copy=copies[table];
    const column=async name=>(await all(db,`PRAGMA table_xinfo(${quote(name)})`)).find(c=>c.name===keyColumn);
    const value=await column(copy)?quote(keyColumn):'('+((await column(table))?.dflt_value??'NULL')+')';
    const keys=new Set((await all(db,`SELECT DISTINCT ${value} COLLATE BINARY AS key FROM ${quote(copy)} WHERE ${value} IS NOT NULL`)).map(x=>x.key));
    const listed=objects.filter(x=>x.bucket===binding);
    insist([...keys].every(key=>namespaced(spec.prefix??'',key)) && listed.length===keys.size && listed.every(x=>keys.has(x.key)),'object_references:'+binding);
  }
}
