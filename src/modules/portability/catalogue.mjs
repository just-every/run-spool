import { all, insist, quote, PortabilityError } from './storage.mjs';
import { canonicalJson, base64, unbase64, utf8 } from './hash.mjs';
import { schemaIdentityOf } from './schema-identity.mjs';
import { platformTables, platformTable, identifier, matches } from './bookkeeping.mjs';
/** Platform bookkeeping is mandatory; operator identity remains a seed choice. */
export const excludedTables=Object.freeze([...platformTables,'oa_%','oc_%']);
const fields=['product','excludeTables','includeTables','derivedTables','secretColumns','exportRow','importSafety','importRow','replaceableTables','requiredConfiguration','validateStaged','acceptedSchemas','buckets','extraPayloads','partBytes'];
const name=value=>typeof value==='string' && value.length>0 && value.length<=512 && !/[\x00-\x1f]/.test(value);
const names=value=>Array.isArray(value) && value.every(name) && new Set(value).size===value.length;
const record=value=>value && typeof value==='object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const safeCell=value=>{
  if(value===null || typeof value==='string' || (typeof value==='number' && Number.isFinite(value)))return true;
  if(!record(value) || Object.keys(value).length!==1 || typeof value.blob!=='string')return false;
  try{unbase64(value.blob);return true;}catch{return false;}
};
export function policy(input) {
  insist(input && typeof input==='object' && Object.keys(input).every(k=>fields.includes(k)) && name(input.product),'invalid_policy');
  const result={excludeTables:[],includeTables:[],derivedTables:[],secretColumns:{},importSafety:{},replaceableTables:[],requiredConfiguration:[],acceptedSchemas:{},buckets:{},extraPayloads:{},partBytes:16*1024*1024,...input};
  for(const key of ['excludeTables','includeTables','derivedTables','replaceableTables','requiredConfiguration']) insist(names(result[key]),'invalid_policy_'+key);
  for(const table of result.includeTables) if(platformTable(table)) {
    const error=new PortabilityError('platform_table:'+table);
    error.message='includeTables cannot include platform-owned table "'+table+'".';throw error;
  }
  for(const key of ['exportRow','importRow','validateStaged']) insist(result[key]===undefined || typeof result[key]==='function','invalid_policy_'+key);
  insist(record(result.importSafety),'invalid_policy_importSafety');
  const safety=Object.create(null);
  for(const [table,columns] of Object.entries(result.importSafety)) {
    insist(name(table) && record(columns) && Object.keys(columns).length>0,'invalid_import_safety:'+table);
    const declared=Object.create(null);
    for(const [column,values] of Object.entries(columns)) {
      insist(name(column) && Array.isArray(values) && values.length>0,'invalid_import_safety:'+table+':'+column);
      const cells=Array.from(values,value=>record(value)?{...value}:value);
      insist(cells.every(safeCell) && new Set(cells.map(canonicalJson)).size===cells.length,'invalid_import_safety:'+table+':'+column);
      // The hook's closure cannot expand the declaration while it runs.
      declared[column]=Object.freeze(cells.map(value=>value && typeof value==='object'?Object.freeze({...value}):value));
    }
    safety[table]=Object.freeze(declared);
  }
  insist(Boolean(result.importRow)===(Object.keys(safety).length>0),'invalid_policy_importSafety_pair');
  result.importSafety=Object.freeze(safety);
  insist(Number.isSafeInteger(result.partBytes) && result.partBytes>=1024 && result.partBytes<=16*1024*1024,'invalid_part_limit');
  for(const [table,columns] of Object.entries(result.secretColumns)) insist(name(table) && names(columns),'invalid_secret_columns');
  for(const [identity,entry] of Object.entries(result.acceptedSchemas)) insist(/^[a-f0-9]{64}$/.test(identity) && typeof entry.upgradeRow==='function','invalid_accepted_schema');
  for(const [binding,entry] of Object.entries(result.buckets)) {
    insist(name(binding) && entry && Object.keys(entry).every(k=>['prefix','objectReferences'].includes(k)),'invalid_bucket_policy');
    insist(entry.prefix===undefined || typeof entry.prefix==='string','invalid_bucket_prefix');
    if(entry.objectReferences) insist(name(entry.objectReferences.table) && name(entry.objectReferences.keyColumn),'invalid_object_references');
  }
  for(const [key,entry] of Object.entries(result.extraPayloads)) insist(name(key) && typeof entry.produce==='function' && typeof entry.consume==='function','invalid_extra_payload');
  for(const key of ['secretColumns','acceptedSchemas','buckets','extraPayloads'])result[key]=Object.assign(Object.create(null),result[key]);
  return {...result,excludeTables:[...excludedTables,...result.excludeTables]};
}
/** Platform tables are always excluded; explicit includes override only optional exclusions. */
export const excludedTable=(table,input={})=>platformTable(table) || (!(input.includeTables??[]).includes(table) && [...excludedTables,...(input.excludeTables??[])].some(pattern=>matches(table,pattern)));
async function archived(db,config) {
  const objects=await all(db,"SELECT name,sql,type,tbl_name FROM sqlite_master WHERE sql IS NOT NULL AND substr(lower(name),1,7) <> 'sqlite_' AND substr(lower(name),1,4) <> '_cf_' ORDER BY name");
  const kinds=await all(db,'PRAGMA table_list');
  const derived=config.derivedTables;
  const excluded=objects.filter(x=>x.type==='table' && (excludedTable(x.name,config) || (!config.includeTables.includes(x.name) &&
    derived.some(p=>x.name===p || (kinds.find(k=>k.name===x.name)?.type==='shadow' && x.name.startsWith(p+'_'))))));
  objects.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:a.type<b.type?-1:a.type>b.type?1:0);
  // Row exclusions never erase behavioral schema evidence, even for objects
  // attached to excluded tables. Only literal engine-internal names are exempt.
  const schemaObjects=objects.filter(x=>['index','view','trigger'].includes(x.type)).map(({name,type,tbl_name,sql})=>({name,type,table:tbl_name,sql}));
  return {objects,kinds,excluded,schemaObjects,entries:objects.filter(x=>x.type==='table' && !excluded.some(y=>y.name===x.name))};
}
// The archive schema identity alone, for databases that need not satisfy the policy.
export async function schemaIdentity(db,config,{legacyExcludedObjects=false,tablesOnly=false}={}) {
  const {entries,excluded,schemaObjects}=await archived(db,config);
  // Acknowledged v1 recovery places an old backup using its historical
  // projection; acknowledged recovery of a version 2 archive without an object
  // inventory compares tables only. Current archives always retain the
  // complete object inventory.
  const objects=tablesOnly?[]:legacyExcludedObjects?schemaObjects.filter(object=>!excluded.some(table=>table.name===object.table)):schemaObjects;
  return schemaIdentityOf(entries,objects);
}
export async function catalogue(db,config) {
  const {objects,kinds,excluded,entries,schemaObjects}=await archived(db,config);
  const tables=[];
  for(const entry of entries) {
    insist(!/^CREATE\s+VIRTUAL\s+TABLE/i.test(entry.sql) && kinds.find(x=>x.name===entry.name)?.type!=='shadow','virtual_table:'+entry.name);
    const columns=(await all(db,`PRAGMA table_xinfo(${quote(entry.name)})`)).map(c=>({name:c.name,type:c.type,notnull:c.notnull,pk:c.pk,hidden:c.hidden}));
    insist(columns.every(c=>[0,2,3].includes(c.hidden) && !c.name.startsWith('rer_portability_')),'unsupported_column:'+entry.name);
    columns.forEach(c=>{if(c.hidden)c.generated=c.hidden===2?'virtual':'stored';delete c.hidden;});
    // Both archived base cells and visible staging reads must fit D1's SQL
    // limit, with room for copy names and joins.
    insist([false,true].every(encoded=>utf8(projectedColumns({columns},encoded)).length+1024+columns.length*64<=100000),'transfer_sql_limit:'+entry.name);
    const dependencies=[...new Set((await all(db,`PRAGMA foreign_key_list(${quote(entry.name)})`)).map(ref=>objects.find(x=>x.type==='table' && identifier(x.name)===identifier(ref.table))?.name??ref.table))].sort();
    for(const parent of dependencies) insist(!excluded.some(x=>x.name===parent),'excluded_foreign_key:'+entry.name+':'+parent);
    const rowidAlias=columns.some(c=>c.pk)?null:['rowid','_rowid_','oid'].find(alias=>!columns.some(c=>c.name.toLowerCase()===alias));
    insist(rowidAlias!==undefined,'unsupported_rowid:'+entry.name);
    insist(['rowid','_rowid_','oid'].some(alias=>!columns.some(c=>c.name.toLowerCase()===alias)),'unsupported_copy_rowid:'+entry.name);
    tables.push({name:entry.name,sql:entry.sql,columns,dependencies,rowidAlias});
  }
  for(const [table,list] of Object.entries(config.secretColumns)) {
    const entry=tables.find(t=>t.name===table); insist(entry,'secret_table_missing:'+table);
    for(const key of list) {const column=entry.columns.find(c=>c.name===key);insist(column && !column.notnull && !column.pk && !column.generated,'invalid_secret_column:'+table+':'+key);}
  }
  for(const [table,columns] of Object.entries(config.importSafety)) {
    const entry=tables.find(t=>t.name===table);insist(entry,'import_safety_table_missing:'+table);
    for(const [key,values] of Object.entries(columns)) {
      const column=entry.columns.find(c=>c.name===key);
      insist(column && !column.generated && !column.pk,'invalid_import_safety_column:'+table+':'+key);
      for(const value of values)validateRow({...entry,columns:[column]},{[key]:value});
    }
  }
  for(const table of [...config.replaceableTables,...config.includeTables]) insist(tables.some(x=>x.name===table),'policy_table_missing:'+table);
  for(const spec of Object.values(config.buckets)) if(spec.objectReferences) {
    const {table,keyColumn}=spec.objectReferences;
    insist(tables.find(x=>x.name===table)?.columns.some(c=>c.name===keyColumn),'reference_column_missing');
    insist(!config.secretColumns[table]?.includes(keyColumn),'reference_column_excluded');
  }
  const identity=await schemaIdentityOf(tables,schemaObjects);
  return {identity,tables,schemaObjects,excludedTables:excluded.map(x=>x.name).sort(),triggers:objects.filter(x=>x.type==='trigger' && tables.some(t=>t.name===x.tbl_name))};
}
export function affinity(type) {
  const text=type.toUpperCase();
  if(text.includes('INT')) return 'INTEGER';
  if(/CHAR|CLOB|TEXT/.test(text)) return 'TEXT';
  if(text==='' || text.includes('BLOB')) return 'BLOB';
  return 'NUMBER';
}
export function projectedColumns(table,encoded=false) {
  return (encoded?writableColumns(table):table.columns).map(c=>encoded && affinity(c.type)==='INTEGER'?`CAST(s.${quote(c.name)} AS TEXT) AS ${quote(c.name)}`:`s.${quote(c.name)}`).join(',');
}
export const writableColumns=table=>table.columns.filter(c=>!c.generated);
export function validateRow(table,row,secrets=[]) {
  const columns=writableColumns(table).filter(c=>!secrets.includes(c.name));
  insist(row && typeof row==='object' && !Array.isArray(row) && canonicalJson(Object.keys(row).sort())===canonicalJson(columns.map(c=>c.name).sort()),'row_columns:'+table.name);
  for(const column of columns) {
    const value=row[column.name],type=affinity(column.type), label=table.name+':'+column.name;
    if(value===null) {insist(!column.notnull,'row_not_null:'+label);continue;}
    if(typeof value==='object') {
      insist(Object.keys(value).length===1 && typeof value.blob==='string','row_type:'+label); unbase64(value.blob);
      insist(type==='BLOB','row_type:'+label);continue;
    }
    insist(typeof value==='string' || (typeof value==='number' && Number.isFinite(value)),'row_type:'+label);
    if(type==='INTEGER') insist(typeof value==='number' && Number.isSafeInteger(value),'unsafe_integer:'+label);
    if(type==='NUMBER') insist(typeof value==='number','row_type:'+label);
    if(type==='TEXT') insist(typeof value==='string','row_type:'+label);
  }
}
export function encodedRow(table,raw,secrets=[]) {
  const row=Object.create(null);
  for(const column of writableColumns(table)) {
    if(secrets.includes(column.name)) continue;
    let value=raw[column.name];
    if(affinity(column.type)==='INTEGER' && value!==null) {
      insist(/^-?\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)),'unsafe_integer:'+table.name+':'+column.name);
      value=Number(value);
    }
    if(Array.isArray(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) value={blob:base64(Array.isArray(value)?Uint8Array.from(value):new Uint8Array(value.buffer??value,value.byteOffset??0,value.byteLength))};
    row[column.name]=value;
  }
  validateRow(table,row,secrets); return row;
}
export function bindCell(value) { return value && typeof value==='object' ? unbase64(value.blob).buffer : value; }
export function mapRow(config,table,row) {
  if(!config.exportRow) return row;
  const result=config.exportRow(table.name,structuredClone(row));
  insist(!(result instanceof Promise),'export_row_must_be_pure');
  validateRow(table,result,config.secretColumns[table.name]??[]);
  insist(canonicalJson(config.exportRow(table.name,structuredClone(result)))===canonicalJson(result),'export_row_not_idempotent:'+table.name);
  return result;
}
