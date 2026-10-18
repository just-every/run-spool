import type { D1TargetAdapter, D1Database, D1Sql } from '../../modules/import-kit/src/d1/types.ts';
import type { TargetRow } from '../../modules/import-kit/src/types.ts';
import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
const definitions:Record<string,{table:string;keys:string[];columns:string[]}>= {
  project:{table:'projects',keys:['id'],columns:['id','name','created']},
  release:{table:'releases',keys:['project','name'],columns:['project','name','seq','build','created']},
  issue:{table:'issues',keys:['id'],columns:['id','project','fingerprint','algorithm','title','state','revision','count','first_seen','last_seen','resolved_seq','latest_release_seq']},
  event:{table:'events',keys:['project','id'],columns:['id','project','issue','release','release_seq','build','environment','payload','digest','diagnostic','received','occurrence','historical']},
};
const sql=(sql:string,...params:any[]):D1Sql=>({sql,params});
function address(destination:string,kind:string,id:string){
  if(destination!=='spool-owner')throw new Error('Invalid import destination');
  const definition=definitions[kind];if(!definition)throw new Error('Invalid native target kind');
  const values=definition.keys.length===1?[id]:JSON.parse(id);
  if(!Array.isArray(values)||values.length!==definition.keys.length||values.some(v=>typeof v!=='string'))throw new Error('Invalid native identity');
  return {...definition,values,where:definition.keys.map(key=>`${key}=?`).join(' AND ')};
}
async function read(db:D1Database,destination:string,kind:string,id:string):Promise<TargetRow|undefined>{
  const a=address(destination,kind,id);
  const native=await db.prepare(`SELECT * FROM ${a.table} WHERE ${a.where}`).bind(...a.values).first();
  const metadata=await db.prepare('SELECT revision,source FROM sentry_import_targets WHERE kind=? AND id=?').bind(kind,id).first();
  if(!native){if(metadata)throw new Error('Imported native row missing');return undefined}
  return {destination,targetKind:kind,targetId:id,revision:metadata?.revision??`native:${sha256(canonicalJson(native))}`,value:{native,source:metadata?JSON.parse(metadata.source):null}};
}
export const sentryTargets:D1TargetAdapter={
  read,
  matches(row,destination,kind,id){
    const a=address(destination,kind,id);
    if(!row)return sql(`NOT EXISTS(SELECT 1 FROM ${a.table} WHERE ${a.where}) AND NOT EXISTS(SELECT 1 FROM sentry_import_targets WHERE kind=? AND id=?)`,...a.values,kind,id);
    const value=row.value as any,native=value.native;
    if(!native||Object.keys(native).some(key=>!a.columns.includes(key))||a.columns.some(key=>!(key in native)))throw new Error('Native row schema changed');
    const terms=a.columns.map(key=>`${key} IS ?`).join(' AND ');
    const metadata=value.source===null?sql('NOT EXISTS(SELECT 1 FROM sentry_import_targets WHERE kind=? AND id=?)',kind,id):sql('EXISTS(SELECT 1 FROM sentry_import_targets WHERE kind=? AND id=? AND revision=? AND source=?)',kind,id,row.revision,canonicalJson(value.source));
    return sql(`EXISTS(SELECT 1 FROM ${a.table} WHERE ${terms}) AND (${metadata.sql})`,...a.columns.map(key=>native[key]),...metadata.params!);
  },
  write(row){
    const a=address(row.destination,row.targetKind,row.targetId),value=row.value as any,native=value.native;
    if(!native||a.columns.some(key=>!(key in native))||Object.keys(native).some(key=>!a.columns.includes(key)))throw new Error('Invalid native row');
    if(a.keys.some((key,index)=>native[key]!==a.values[index]))throw new Error('Native identity mismatch');
    return [sql(`INSERT INTO ${a.table}(${a.columns.join(',')}) VALUES(${a.columns.map(()=>'?').join(',')}) ON CONFLICT(${a.keys.join(',')}) DO UPDATE SET ${a.columns.filter(key=>!a.keys.includes(key)).map(key=>`${key}=excluded.${key}`).join(',')}`,...a.columns.map(key=>native[key])),
      value.source===null?sql('DELETE FROM sentry_import_targets WHERE kind=? AND id=?',row.targetKind,row.targetId):sql('INSERT INTO sentry_import_targets(kind,id,revision,source) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,source=excluded.source',row.targetKind,row.targetId,row.revision,canonicalJson(value.source))];
  },
  remove(destination,kind,id){const a=address(destination,kind,id);return [sql(`DELETE FROM ${a.table} WHERE ${a.where}`,...a.values),sql('DELETE FROM sentry_import_targets WHERE kind=? AND id=?',kind,id)]},
  // The native set an import guards is its own imported targets, read in one
  // query per kind however many rows exist; ingested evidence stays outside it.
  async list(db,destination){
    if(destination!=='spool-owner')throw new Error('Invalid import destination');
    const rows:TargetRow[]=[];
    for(const [kind,definition] of Object.entries(definitions)){
      const join=definition.keys.map((key,index)=>`n.${key}=${definition.keys.length===1?'m.id':`json_extract(m.id,'$[${index}]')`}`).join(' AND ');
      const {results}=await db.prepare(`SELECT n.*,m.id AS import_target_id,m.revision AS import_revision,m.source AS import_source FROM sentry_import_targets m JOIN ${definition.table} n ON ${join} WHERE m.kind=? ORDER BY m.id`).bind(kind).all<any>();
      for(const {import_target_id,import_revision,import_source,...native} of results)rows.push({destination,targetKind:kind,targetId:import_target_id,revision:import_revision,value:{native,source:JSON.parse(import_source)}});
    }
    return rows;
  },
  matchesCount(count,destination){
    if(destination!=='spool-owner')throw new Error('Invalid import destination');
    return sql(`(SELECT COUNT(*) FROM sentry_import_targets)=? AND NOT EXISTS(SELECT 1 FROM sentry_import_targets m WHERE ${Object.entries(definitions).map(([kind,d])=>`(m.kind='${kind}' AND NOT EXISTS(SELECT 1 FROM ${d.table} n WHERE ${d.keys.map((key,index)=>`n.${key}=${d.keys.length===1?'m.id':`json_extract(m.id,'$[${index}]')`}`).join(' AND ')}))`).join(' OR ')})`,count);
  },
};
