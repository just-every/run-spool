import { encodedRow, validateRow, bindCell } from './catalogue.mjs';
import { readCopy, copyRowid } from './copies.mjs';
import { canonicalJson } from './hash.mjs';
import { statement, insist, quote } from './storage.mjs';
import { RPC_LIMIT, rpcBytes } from '../d1-transport/index.mjs';

const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
const location=(table,column)=>table.name+(column===undefined?'':':'+column);
function checkResult(config,table,before,after) {
  insist(after && typeof after==='object' && !Array.isArray(after) && typeof after.then!=='function','import_row_must_be_pure:'+table.name,409);
  const keys=Reflect.ownKeys(after),original=Object.keys(before);
  const structural=[...keys.filter(k=>!original.includes(k)),...original.filter(k=>!Object.prototype.propertyIsEnumerable.call(after,k))];
  insist(!structural.length,'import_row_columns:'+location(table,String(structural[0])),409);
  validateRow(table,after);
  for(const column of original) {
    insist(after[column]!==undefined,'import_row_columns:'+location(table,column),409);
    if(same(before[column],after[column]))continue;
    insist(!table.columns.some(c=>c.name===column && c.pk),'import_row_key:'+location(table,column),409);
    const allowed=config.importSafety[table.name][column];
    insist(allowed,'import_row_undeclared:'+location(table,column),409);
    insist(allowed.some(value=>same(value,after[column])),'import_row_unsafe_value:'+location(table,column),409);
  }
  return structuredClone(after);
}
function mapImportRow(config,table,before) {
  const apply=row=>checkResult(config,table,row,config.importRow(table.name,structuredClone(row)));
  const after=apply(before),again=apply(before),twice=apply(after);
  for(const [result,reason] of [[again,'deterministic'],[twice,'idempotent']]) {
    const column=Object.keys(before).find(key=>!same(after[key],result[key]));
    insist(column===undefined,'import_row_not_'+reason+':'+location(table,column),409);
  }
  return after;
}
function countChanges(summary,table,before,after) {
  for(const column of Object.keys(before))if(!same(before[column],after[column])) {
    let entry=summary.find(x=>x.table===table.name && x.column===column && same(x.value,after[column]));
    if(!entry){entry={table:table.name,column,value:after[column],rows:0};summary.push(entry);}
    entry.rows++;
  }
}
const guardSql=`INSERT INTO rer_portability_guard(value) SELECT CASE WHEN (
  EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=? AND metadata=?)
  AND (SELECT import_job FROM rer_portability_state WHERE id=1)=?
) THEN 1 ELSE 0 END`;
const checkpoint=(row,before,metadata,queries)=>[
  {sql:guardSql,params:[row.id,before,row.id]},...queries,
  {sql:'UPDATE rer_portability_jobs SET phase=?,completed=?,metadata=? WHERE id=?',params:[row.phase,row.completed,canonicalJson(metadata),row.id]},
  {sql:'DELETE FROM rer_portability_guard'},
];
// Each page's staged updates, cursor and value-free change counts commit together.
// A resumed finalize never transforms an already-normalized row or recounts it.
export async function normalizeStaged(context,row) {
  const {db,config}=context;if(!config.importRow)return;
  for(const table of row.metadata.targets.filter(t=>Object.hasOwn(config.importSafety,t.name))) {
    const copy=row.metadata.copies[table.name],count=row.metadata.stagedCounts?.[table.name]??0;
    let offset=row.metadata.safetyProgress?.[table.name]??0;
    while(offset<count) {
      let before=canonicalJson(row.metadata),queries=[];
      const commit=async()=>{
        await db.batch(checkpoint(row,before,row.metadata,queries).map(q=>statement(db,q.sql,...(q.params??[]))));
        before=canonicalJson(row.metadata);queries=[];
      };
      for(const {row:raw,meta} of await readCopy(db,table,copy,offset,100,true)) {
        const original=encodedRow(table,raw),after=mapImportRow(config,table,original);
        const columns=Object.keys(original).filter(key=>!same(original[key],after[key]));
        insist(Number.isSafeInteger(meta.rer_portability_copy_rowid),'copy_rowid');
        const query=columns.length?{sql:`UPDATE ${quote(copy)} SET ${columns.map(c=>quote(c)+'=?').join(',')} WHERE ${copyRowid(table)}=${meta.rer_portability_copy_rowid}`,params:columns.map(c=>bindCell(after[c]))}:undefined;
        // Reserve room for a metadata checkpoint and its concurrency guard.
        const summary=structuredClone(row.metadata.safetyChanges??[]);countChanges(summary,table,original,after);
        const metadata={...row.metadata,safetyChanges:summary,safetyProgress:{...row.metadata.safetyProgress,[table.name]:offset+1}};
        const pending=[...queries,...(query?[query]:[])];
        if(rpcBytes(checkpoint(row,before,metadata,pending))>RPC_LIMIT && queries.length)await commit();
        insist(rpcBytes(checkpoint(row,before,metadata,[...queries,...(query?[query]:[])]))<=RPC_LIMIT,'D1_RPC_TRANSPORT_LIMIT',413);
        if(query)queries.push(query);
        row.metadata=metadata;offset++;
      }
      await commit();
    }
  }
}
