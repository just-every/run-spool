import { bundleDefaults } from './bundle-grouping';
import { operatorDefaults } from './operators/archive';
import { readArchive, canonicalJson, PortabilityError } from '../modules/portability/index.mjs';
import { validateArchiveRows } from './archive';
import { upgradeOccurrence } from './occurrences';
import { legacyIssueReleases } from './issue-release';
import { emptyLinkTables } from './link-archive';
import { emptyExecutionTables } from './execution-archive';
import { legacyImportDefaults } from './sentry-import/archive';
// Only the exact prior inventories emitted before alert/import additions qualify.
const previousSchema = '502ff0b6cf7bc791c78a453621e0672e71b20aca5d4e6dfd6a7fc6705925879b';
const occurrenceSchema = '545f89fdc612b347d00ecbf8e4e8f48db6e52bf658265f456ac71c3294629616';
export const isPreviousSchema=(schema:unknown)=>schema===previousSchema||schema===occurrenceSchema;
const priorTables=['alerts','artifacts','audit','browser_origins','events','issues','outcomes','projects','releases'];
const priorConfiguration=['OWNER_EMAIL','SESSION_SECRET','SETUP_TOKEN','AUTH_ORIGIN','AUTH_LOCAL','MAIL_PROVIDER','MAIL_FROM'];
const addedColumns:Record<string,string[]>={events:['historical'],issues:['latest_release_seq'],alerts:['payload']};
function requireMatch(condition:unknown,code:string):asserts condition {if(!condition)throw new PortabilityError(code)}
export async function readPreviousArchive(source:ReadableStream<Uint8Array>){
 let size=0,manifest:any,closed=false;
 const data:Record<string,any[]>={};
 // Preserve streaming verification, but bound this historical normalization path.
 const bounded=source.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(bytes,controller){size+=bytes.length;if(size>16*1024*1024)throw new PortabilityError('legacy_archive_size',413);controller.enqueue(bytes)}}));
 for await(const record of readArchive(bounded)){
  if(record.kind==='manifest'){
   manifest=record;
   requireMatch(isPreviousSchema(manifest.schema)&&manifest.product==='runeditrun/errors-workbench','legacy_schema');
   requireMatch(canonicalJson(manifest.tables.map((table:any)=>table.name))===canonicalJson(priorTables),'legacy_table_inventory');
   requireMatch(canonicalJson(manifest.requiredConfiguration)===canonicalJson(priorConfiguration)&&canonicalJson(manifest.excludedColumns)==='{}'&&!manifest.objects.length&&!manifest.payloads.length,'legacy_configuration_inventory');
   for(const name of priorTables)data[name]=[];
  }else if(record.kind==='part'){
   for(const item of record.items){requireMatch(item.kind==='row'&&Object.hasOwn(data,item.table),'legacy_row_inventory');data[item.table].push(item.row)}
  }else closed=true;
 }
 requireMatch(closed,'closing_missing');
 return {manifest,data};
}
export async function normalizePreviousArchive(previous:Awaited<ReturnType<typeof readPreviousArchive>>,current:any){
 // SQL identity was verified by Base. Check independently supplied column/key
 // descriptors too, so a forged old primary key cannot change erasure custody.
 for(const old of previous.manifest.tables){
  const target=current.tables.find((table:any)=>table.name===old.name);
  requireMatch(target,'legacy_table_inventory');
  const added=[...(addedColumns[old.name]??[]),...(previous.manifest.schema===previousSchema&&['events','artifacts'].includes(old.name)?['occurrence']:[])];
  const columns=target.columns.filter((column:any)=>!added.includes(column.name));
  requireMatch(canonicalJson(old.columns)===canonicalJson(columns)&&canonicalJson(old.dependencies)===canonicalJson(target.dependencies)&&old.rowidAlias===target.rowidAlias,'legacy_column_inventory');
 }
 const upgraded=Object.fromEntries(Object.entries(previous.data).map(([table,rows])=>[table,rows.map(row=>Object.hasOwn(row,'occurrence')?row:upgradeOccurrence(table,row))]));
 const legacy=await validateArchiveRows(bundleDefaults(operatorDefaults(legacyIssueReleases(legacyImportDefaults(upgraded)))));
 const data={...legacy,alerts:legacy.alerts.map((row:any)=>({...row,payload:null})),alert_rules:[],alert_history:[],repairs:[],repair_checks:[],rer_erasure_operations:[],...emptyLinkTables(),...emptyExecutionTables()};
 return {data,manifest:{...current,sourceIdentity:previous.manifest.sourceIdentity,epoch:previous.manifest.epoch,journal:previous.manifest.journal,exportedAt:previous.manifest.exportedAt}};
}

/** Only the exact previous configuration inventory can retire the bootstrap token. */
export function retireArchiveSetupToken(manifest: any, configuration: string[]) {
 const previous = [...configuration]; previous.splice(2, 0, 'SETUP_TOKEN');
 return canonicalJson(manifest.requiredConfiguration) === canonicalJson(previous)
  ? { ...manifest, requiredConfiguration: configuration } : manifest;
}
