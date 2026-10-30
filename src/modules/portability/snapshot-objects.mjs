import { excludedTable } from './catalogue.mjs';
import { identifier } from './bookkeeping.mjs';
import { schemaIdentityOf } from './schema-identity.mjs';

// Project only the archive's identity. Live and replay catalogues still attest
// every object they contain; the original manifest remains the digest input.
export async function withoutAbsentExcludedObjects(manifest,cat,config) {
  if(manifest.schemaObjects===undefined)return manifest;
  const restorable=new Set([...manifest.tables,...cat.tables].map(table=>identifier(table.name)));
  const present=new Set([...cat.excludedTables,...cat.tables.map(table=>table.name)].map(identifier));
  const schemaObjects=manifest.schemaObjects.filter(object=>!(
    manifest.excludedTables?.includes(object.table) && !restorable.has(identifier(object.table))
    && !present.has(identifier(object.table)) && excludedTable(object.table,config)));
  if(schemaObjects.length===manifest.schemaObjects.length)return manifest;
  return {...manifest,schemaObjects,schema:await schemaIdentityOf(manifest.tables,schemaObjects)};
}
