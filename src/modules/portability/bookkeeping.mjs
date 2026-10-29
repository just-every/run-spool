import { schemaIdentityOf } from './schema-identity.mjs';
import { insist } from './storage.mjs';

// Installation authority and transient working state, never product data.
// Keep exact names except for SQLite/Cloudflare internals and portability's
// own dynamic copies. Durable erasure receipts and dependency bindings travel.
export const platformTables=Object.freeze([
  'sqlite_%','_cf_%','d1_migrations','rer_migrations','ik_d1_assertions',
  '_rer_deploy_migrations','_rer_portability_migrations','rer_portability_%',
  'rer_mail_development_outbox','rer_ai_development_outbox',
  'rer_dependency_keys','rer_dependency_pending','rer_dependency_codes',
  'rer_command_receipts','rer_erasure_blobs','rer_erasure_guard',
  'rer_erasure_scope','rer_erasure_rates','rer_demo',
]);
export const identifier=value=>value.replace(/[A-Z]/g,letter=>letter.toLowerCase());
export const matches=(table,pattern)=>pattern.endsWith('%') ? identifier(table).startsWith(identifier(pattern.slice(0,-1))) : identifier(table)===identifier(pattern);
export const platformTable=table=>platformTables.some(pattern=>matches(table,pattern));
// Compatibility uses the product schema, while the original manifest and parts
// remain intact for end-to-end archive verification, including skipped rows.
export async function restorableManifest(manifest) {
  // Successful import-kit units always clear their CHECK guard rows before
  // committing. An old archive may carry the empty table, never its rows.
  for(const table of manifest.tables)if(identifier(table.name)==='ik_d1_assertions')
    insist(table.count===0,'invalid_bookkeeping_rows:'+table.name,409);
  const tables=manifest.tables.filter(table=>!platformTable(table.name));
  const schemaObjects=manifest.schemaObjects?.filter(object=>!manifest.tables.some(table=>platformTable(table.name) && table.name===object.table));
  return {...manifest,tables,...(schemaObjects?{schemaObjects}:{}),schema:await schemaIdentityOf(tables,schemaObjects),
    excludedColumns:Object.fromEntries(Object.entries(manifest.excludedColumns).filter(([name])=>!platformTable(name)))};
}
export const skippedTablesLine=tables=>'Skipped platform bookkeeping tables: '+tables.join(', ')+'.';
