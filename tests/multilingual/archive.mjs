import {makePart,canonicalJson,sha256} from '../../src/modules/portability/index.mjs';
import {ContentVerifier,ArchiveVerifier} from '../../src/modules/portability/format.mjs';
// Re-sign deliberate archive mutations so semantic validation, not checksums,
// has to refuse corrupt mapping custody. Only test fixture bytes are changed.
export async function mappingArchive(text,edit=()=>{},previous=false){
 const records=text.trim().split('\n').map(JSON.parse),manifest=records[0];
 const rows=Object.fromEntries(manifest.tables.map(t=>[t.name,[]]));
 for(const part of records.filter(r=>r.kind==='part'))for(const item of part.items)if(item.kind==='row')rows[item.table].push(item.row);
 edit(rows);
 // Rebuilt from rows alone: no safe-audit payload.
 manifest.payloads=[];
 if(previous){
  // The pre-mapping archive also predates bundle grouping and inbound policies.
  manifest.tables=manifest.tables.filter(t=>!['deployment_path_mappings','grouping_routes','inbound_filter_policies','feedback','grouping_policies','release_policies','release_metadata','release_builds','issue_resolutions','deployment_runs','deployment_steps','deployment_notices'].includes(t.name));
  if(manifest.migrations)manifest.migrations=manifest.migrations.filter(name=>!['0034_source_paths.sql','0035_bundle_grouping.sql','0038_investigation_indexes.sql','0039_inbound_filters.sql','0040_feedback.sql','0041_business_import_door.sql','0042_grouping_rules.sql','0043_sentry_releases.sql','0044_import_preparation_steps.sql','0045_import_custody_replace.sql','0046_import_erasure_progress.sql','0047_import_door_apply_failures.sql','0048_import_door_scopes.sql','0049_deployment_history.sql','0050_release_order_keys.sql','0051_safe_audit.sql','0052_release_order_cache.sql','0053_audit_transactions.sql','0055_import_door_archives.sql'].includes(name));
  manifest.schema=await sha256(canonicalJson(manifest.tables.map(({name,sql})=>({name,sql}))));
 }
 const items=[];for(const table of manifest.tables){table.count=rows[table.name].length;for(const [index,row] of rows[table.name].entries())items.push({kind:'row',table:table.name,index,row,...(table.rowidAlias?{rowid:index+1}:{})});}
 const parts=[];for(let i=0;i<items.length;i+=200)parts.push(await makePart(parts.length,items.slice(i,i+200)));manifest.partCount=parts.length;
 const content=new ContentVerifier(manifest),binding=new ArchiveVerifier(manifest);for(const part of parts){binding.add(part);for(const item of part.items)content.add(item);}
 return [manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:binding.digest()}].map(row=>JSON.stringify(row)).join('\n')+'\n';
}
