import { importedAlertPrefix } from '../alerts/import-state';
import type { D1TargetAdapter, D1Database, D1Sql } from '../../modules/import-kit/src/d1/types.ts';
import type { TargetRow } from '../../modules/import-kit/src/types.ts';
import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
const definitions:Record<string,{table:string;keys:string[];columns:string[]}>= {
  'import-proposal':{table:'spool_import_proposals',keys:['id'],columns:['id','project','kind','payload','state','version','created']},
  project:{table:'projects',keys:['id'],columns:['id','name','created']},
  release:{table:'releases',keys:['project','name'],columns:['project','name','seq','build','created']},
  issue:{table:'issues',keys:['id'],columns:['id','project','fingerprint','algorithm','title','state','revision','count','first_seen','last_seen','resolved_seq','latest_release_seq']},
  event:{table:'events',keys:['project','id'],columns:['id','project','issue','release','release_seq','build','environment','payload','digest','diagnostic','received','occurrence','historical']},
};
const sql=(sql:string,...params:any[]):D1Sql=>({sql,params});
// Approval leaves the reviewed proposal byte-for-byte intact. Native revisions,
// delivery history and independently configured consumers fence old undo plans.
const editedAlert = (proposal: string) => `EXISTS(SELECT 1 FROM alert_rules r WHERE r.id='${importedAlertPrefix}'||${proposal} AND (
  r.revision<>1 OR EXISTS(SELECT 1 FROM alert_history h WHERE h.rule_id=r.id)
  OR EXISTS(SELECT 1 FROM alert_snoozes z WHERE z.scope='rule' AND z.target=r.id)
  OR EXISTS(SELECT 1 FROM spool_team_snoozes z WHERE z.scope='rule' AND z.target=r.id)
  OR EXISTS(SELECT 1 FROM alert_rules other WHERE other.destination=r.id||'-target' AND other.id<>r.id)
  OR EXISTS(SELECT 1 FROM alert_target_destinations d WHERE d.id=r.id||'-target' AND d.label<>r.name)))`;

function removeImportedAlert(id:string):D1Sql[] {
  const rule=importedAlertPrefix+id;
  const approved=`EXISTS(SELECT 1 FROM spool_import_proposals WHERE id=? AND kind='alert')`;
  const own=`${approved} AND EXISTS(SELECT 1 FROM alert_rules WHERE id=? AND revision=1)`;
  return [
    sql(`DELETE FROM spool_native_audit_actors WHERE audit_id IN (SELECT id FROM audit WHERE kind='alert_rule_created' AND json_extract(detail,'$.rule')=?) AND ${own}`,rule,id,rule),
    sql(`DELETE FROM audit WHERE kind='alert_rule_created' AND json_extract(detail,'$.rule')=? AND ${own}`,rule,id,rule),
    ...['alert_metric_states','alert_metric_events','alert_decisions','alert_cursors','alert_rule_configs','alert_rule_previews'].map(table =>
      sql(`DELETE FROM ${table} WHERE rule_id=? AND ${own}`,rule,id,rule)),
    sql(`DELETE FROM follow_up_feed_custody WHERE alert IN (SELECT id FROM alerts WHERE kind IN ('spike','metric') AND json_extract(payload,'$.rule.id')=?) AND ${own}`,rule,id,rule),
    sql(`DELETE FROM alerts WHERE kind IN ('spike','metric') AND json_extract(payload,'$.rule.id')=? AND ${own}`,rule,id,rule),
    sql(`DELETE FROM alert_target_destinations WHERE id=? AND ${own}`,rule+'-target',id,rule),
    sql(`UPDATE alert_scheduler SET last_spike_rule='' WHERE last_spike_rule=? AND ${own}`,rule,id,rule),
    sql(`DELETE FROM alert_rules WHERE id=? AND revision=1 AND ${approved}`,rule,id),
  ];
}
function address(destination:string,kind:string,id:string){
  if(destination!=='spool-owner')throw new Error('Invalid import destination');
  const definition=definitions[kind];if(!definition)throw new Error('Invalid native target kind');
  const values=definition.keys.length===1?[id]:JSON.parse(id);
  if(!Array.isArray(values)||values.length!==definition.keys.length||values.some(v=>typeof v!=='string'))throw new Error('Invalid native identity');
  return {...definition,values,where:definition.keys.map(key=>`${key}=?`).join(' AND ')};
}
async function read(db:D1Database,destination:string,kind:string,id:string):Promise<TargetRow|undefined>{
  const a=address(destination,kind,id);
  const native=await db.prepare(`SELECT n.*${kind==='import-proposal'?`, ${editedAlert('n.id')} AS import_native_edited`:''} FROM ${a.table} n WHERE ${a.where}`).bind(...a.values).first();
  const metadata=await db.prepare('SELECT revision,source FROM sentry_import_targets WHERE kind=? AND id=?').bind(kind,id).first();
  if(!native){if(metadata)throw new Error('Imported native row missing');return undefined}
  const {import_native_edited:edited,...columns}=native;
  const bound=kind==='project'&&metadata&&await db.prepare('SELECT 1 FROM spool_project_grants WHERE project=? UNION ALL SELECT 1 FROM spool_service_scopes WHERE project=?').bind(id,id).first();
  return {destination,targetKind:kind,targetId:id,revision:edited?`native-edited:${metadata?.revision}`:bound?`authorized:${metadata.revision}`:metadata?.revision??`native:${sha256(canonicalJson(native))}`,value:{native:columns,source:metadata?JSON.parse(metadata.source):null}};
}
export const sentryTargets:D1TargetAdapter={
  read,
  matches(row,destination,kind,id){
    const a=address(destination,kind,id);
    if(!row)return sql(`NOT EXISTS(SELECT 1 FROM ${a.table} WHERE ${a.where}) AND NOT EXISTS(SELECT 1 FROM sentry_import_targets WHERE kind=? AND id=?)`,...a.values,kind,id);
    const value=row.value as any,native=value.native;
    if(!native||Object.keys(native).some(key=>!a.columns.includes(key))||a.columns.some(key=>!(key in native)))throw new Error('Native row schema changed');
    const authority=kind==='project'&&value.source!==null?' AND NOT EXISTS(SELECT 1 FROM spool_project_grants WHERE project=? UNION ALL SELECT 1 FROM spool_service_scopes WHERE project=?)':'';
    const alertGuard=kind==='import-proposal'&&!row.revision.startsWith('native-edited:')?` AND NOT ${editedAlert('n.id')}`:'';
    const terms=a.columns.map(key=>`${key} IS ?`).join(' AND ');
    const metadata=value.source===null?sql('NOT EXISTS(SELECT 1 FROM sentry_import_targets WHERE kind=? AND id=?)',kind,id):sql('EXISTS(SELECT 1 FROM sentry_import_targets WHERE kind=? AND id=? AND revision=? AND source=?)',kind,id,row.revision.replace(/^native-edited:/,''),canonicalJson(value.source));
    return sql(`EXISTS(SELECT 1 FROM ${a.table} n WHERE ${terms}${alertGuard}) AND (${metadata.sql})${authority}`,...a.columns.map(key=>native[key]),...metadata.params!,...authority?[id,id]:[]);
  },
  write(row){
    const a=address(row.destination,row.targetKind,row.targetId),value=row.value as any,native=value.native;
    if(!native||a.columns.some(key=>!(key in native))||Object.keys(native).some(key=>!a.columns.includes(key)))throw new Error('Invalid native row');
    if(a.keys.some((key,index)=>native[key]!==a.values[index]))throw new Error('Native identity mismatch');
    return [sql(`INSERT INTO ${a.table}(${a.columns.join(',')}) VALUES(${a.columns.map(()=>'?').join(',')}) ON CONFLICT(${a.keys.join(',')}) DO UPDATE SET ${a.columns.filter(key=>!a.keys.includes(key)).map(key=>`${key}=excluded.${key}`).join(',')}`,...a.columns.map(key=>native[key])),
      value.source===null?sql('DELETE FROM sentry_import_targets WHERE kind=? AND id=?',row.targetKind,row.targetId):sql('INSERT INTO sentry_import_targets(kind,id,revision,source) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,source=excluded.source',row.targetKind,row.targetId,row.revision,canonicalJson(value.source))];
  },
  remove(destination,kind,id){
    const a=address(destination,kind,id);
    return [...kind==='import-proposal'?removeImportedAlert(id):[],sql(`DELETE FROM ${a.table} WHERE ${a.where}`,...a.values),sql('DELETE FROM sentry_import_targets WHERE kind=? AND id=?',kind,id),
      // Prefixes have no project FK. Remove only this deleted imported project's
      // prefix, so undo restores its auxiliary graph as well as its four targets.
      ...kind==='project'?[sql('DELETE FROM short_id_prefixes WHERE project=? AND NOT EXISTS(SELECT 1 FROM projects WHERE id=?)',id,id)]:[]];
  },
  // The native set an import guards is its own imported targets, read in one
  // query per kind however many rows exist; ingested evidence stays outside it.
  async list(db,destination){
    if(destination!=='spool-owner')throw new Error('Invalid import destination');
    const rows:TargetRow[]=[];
    for(const [kind,definition] of Object.entries(definitions)){
      const join=definition.keys.map((key,index)=>`n.${key}=${definition.keys.length===1?'m.id':`json_extract(m.id,'$[${index}]')`}`).join(' AND ');
      const {results}=await db.prepare(`SELECT n.*${kind==='import-proposal'?`, ${editedAlert('n.id')} AS import_native_edited`:''},m.id AS import_target_id,m.revision AS import_revision,m.source AS import_source FROM sentry_import_targets m JOIN ${definition.table} n ON ${join} WHERE m.kind=? ORDER BY m.id`).bind(kind).all<any>();
      for(const {import_target_id,import_revision,import_source,import_native_edited,...native} of results)rows.push({destination,targetKind:kind,targetId:import_target_id,revision:import_native_edited?'native-edited:'+import_revision:import_revision,value:{native,source:JSON.parse(import_source)}});
    }
    return rows;
  },
  // Compact, exact comparisons use every listed native column and custody value.
  // No revision-only shortcut or digest of caller-supplied metadata can hide an edit.
  matchesMany(rows,destination){
    if(destination!=='spool-owner')throw new Error('Invalid import destination');
    const guards:D1Sql[]=[];
    for(const [kind,d] of Object.entries(definitions)){
      const expected=rows.filter(row=>row.targetKind===kind).map(row=>{
        const a=address(destination,kind,row.targetId),value=row.value as any;
        if(!value?.native||value.source===null||Object.keys(value.native).some(key=>!a.columns.includes(key))||a.columns.some(key=>!(key in value.native)))throw new Error('Native row schema changed');
        return [row.targetId,row.revision,canonicalJson(value.source),...a.columns.map(key=>value.native[key])];
      });
      const revision=kind==='import-proposal'?`CASE WHEN ${editedAlert('n.id')} THEN 'native-edited:'||m.revision ELSE m.revision END`:'m.revision';
      const match=d.columns.map((key,i)=>`n.${key} IS json_extract(e.value,'$[${i+3}]')`).join(' AND ');
      guards.push(sql(`(SELECT COUNT(*) FROM sentry_import_targets WHERE kind=?)=? AND NOT EXISTS(
        SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(
          SELECT 1 FROM sentry_import_targets m JOIN ${d.table} n ON ${d.keys.map((key,i)=>`n.${key}=${d.keys.length===1?'m.id':`json_extract(m.id,'$[${i}]')`}`).join(' AND ')}
          WHERE m.kind=? AND m.id=json_extract(e.value,'$[0]') AND ${revision}=json_extract(e.value,'$[1]')
          AND m.source=json_extract(e.value,'$[2]') AND ${match}))`,kind,expected.length,JSON.stringify(expected),kind));
    }
    guards.push(this.matchesCount!(rows.length,destination));
    return guards;
  },
  matchesCount(count,destination){
    if(destination!=='spool-owner')throw new Error('Invalid import destination');
    return sql(`(SELECT COUNT(*) FROM sentry_import_targets)=? AND NOT EXISTS(SELECT 1 FROM sentry_import_targets m WHERE ${Object.entries(definitions).map(([kind,d])=>`(m.kind='${kind}' AND NOT EXISTS(SELECT 1 FROM ${d.table} n WHERE ${d.keys.map((key,index)=>`n.${key}=${d.keys.length===1?'m.id':`json_extract(m.id,'$[${index}]')`}`).join(' AND ')}))`).join(' OR ')})`,count);
  },
};
