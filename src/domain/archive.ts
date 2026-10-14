import { operatorTables, operatorDefaults, operatorAuditKinds, validateOperators } from './operators/archive';
import { hash, canonical, normalize, identity, scrub } from './privacy';
import { validateMap } from './artifacts';
import { EXPOSURE_LOSS } from './exposure/report';
import { importedTables, legacyImportDefaults, validateImportedRows, importedDiagnostic } from './sentry-import/archive';
import { browserOrigin } from './origins';
import { legacyIssueReleases, validateIssueReleases } from './issue-release';
import { upgradeOccurrence, validateOccurrence } from './occurrences';
export const tables:Record<string,string[]>= {
  projects:['id','name','created'], releases:['project','name','seq','build','created'],
  issues:['id','project','fingerprint','algorithm','title','state','revision','count','first_seen','last_seen','resolved_seq','latest_release_seq'],
  events:['id','project','issue','release','release_seq','build','environment','payload','digest','diagnostic','received','occurrence','historical'],
  artifacts:['project','release','build','debug','payload','digest','created','occurrence'],
  outcomes:['project','window','reason','count'],audit:['id','project','kind','detail','created'],alerts:['id','project','issue','kind','created'],browser_origins:['project','origin','created'],...importedTables,...operatorTables
};
function shape(value:any, fields:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...fields].sort().join())throw new Error('Archive derived field shape');}
function safeText(value:any){if(typeof value!=='string'||scrub(value)!==value)throw new Error('Archive unsanitized text');}
function frame(value:any){shape(value,Object.prototype.hasOwnProperty.call(value??{},'debugId')?['file','line','column','function','debugId']:['file','line','column','function']);const normalized=normalize({version:1,eventId:'validation',release:'validation',build:'validation',environment:'validation',type:'Error',message:'',frames:[value],breadcrumbs:[]}).frames[0];if(canonical(normalized)!==canonical(value))throw new Error('Archive unsanitized frame');}
function diagnostic(value:any,event:any){
 if(!Array.isArray(value)||value.length!==event.frames.length)throw new Error('Archive diagnostic');
 for(let i=0;i<value.length;i++){
  const d=value[i];if(!d||!['missing_debug_id','missing_artifact','identity_mismatch','unmapped_position','mapped','invalid_artifact'].includes(d.status))throw new Error('Archive diagnostic status');
  const fields=['generated','status'];if(['mapped','unmapped_position','invalid_artifact'].includes(d.status))fields.push('artifactDigest');if(d.status==='mapped')fields.push('original');shape(d,fields);frame(d.generated);if(canonical(d.generated)!==canonical(event.frames[i]))throw new Error('Archive generated frame mismatch');
  if('artifactDigest' in d && !/^[a-f0-9]{64}$/.test(d.artifactDigest))throw new Error('Archive diagnostic digest');
  if(d.status==='mapped'){shape(d.original,['file','line','column','function']);frame(d.original);}
 }
}
export async function validateArchive(v:any) {
  shape(v,['version','migration','data','checksum']);
  const legacy=v.version===1&&v.migration==='0001_errors';
  if(!v || (!legacy&&(v.version!==2||v.migration!=='0003_browser_origins'))||!v.data||await hash(canonical({version:v.version,migration:v.migration,data:v.data}))!==v.checksum)throw new Error('Archive identity/checksum mismatch');
  const oldTables=Object.fromEntries(Object.entries(tables).filter(([name])=>!Object.hasOwn(importedTables,name)&&!Object.hasOwn(operatorTables,name)).map(([name,fields])=>[name,fields.filter(field=>!['historical','occurrence','latest_release_seq'].includes(field))]));
  const inputTables=legacy?Object.fromEntries(Object.entries(oldTables).filter(([name])=>name!=='browser_origins')):oldTables;
  if(Object.keys(v.data).sort().join()!==Object.keys(inputTables).sort().join())throw new Error('Archive tables mismatch');
  for(const [table,fields] of Object.entries(inputTables)) {
    const rows=v.data[table];if(!Array.isArray(rows)||rows.length>10000)throw new Error('Archive row budget');
    for(const row of rows){if(!row||Object.keys(row).sort().join()!==[...fields].sort().join()||Object.values(row).some(x=>x!==null&&typeof x!=='string'&&typeof x!=='number')||Object.values(row).some(x=>typeof x==='string'&&x.length>300000))throw new Error('Archive row shape');}
  }
  const upgraded=Object.fromEntries(Object.entries(v.data).map(([table,rows])=>[table,(rows as Record<string,unknown>[]).map(row=>upgradeOccurrence(table,row))]));
  return validateArchiveRows(operatorDefaults(legacyIssueReleases(legacyImportDefaults({...upgraded,browser_origins:legacy?[]:v.data.browser_origins}))),legacy);
}
export async function validateArchiveRows(data:any,legacy=false) {
  const v={data};
  if(Object.keys(data).sort().join()!==Object.keys(tables).sort().join())throw new Error('Archive tables mismatch');
  for(const [table,fields] of Object.entries(tables)) {
    if(!Array.isArray(data[table]))throw new Error('Archive row budget');
    for(const row of data[table]){shape(row,fields);if(Object.values(row).some(x=>x!==null&&typeof x!=='string'&&typeof x!=='number')||Object.values(row).some(x=>typeof x==='string'&&x.length>300000))throw new Error('Archive row shape');}
  }
  for(const row of v.data.projects){safeText(row.name);if(!Number.isSafeInteger(row.created)||row.created<0)throw new Error('Archive timestamp');}
  for(const row of v.data.releases){identity(row.name,'release');identity(row.build,'build');if(!Number.isSafeInteger(row.seq)||row.seq<1)throw new Error('Archive release ordering');}
  const projects=new Set(v.data.projects.map((r:any)=>identity(r.id,'project')));
  const issues=new Map(v.data.issues.map((r:any)=>[r.id,r]));
  const releases=new Map(v.data.releases.map((r:any)=>[r.project+':'+r.name,r]));
  for(const [table,rows] of Object.entries(v.data) as any)for(const row of rows){
    if(!['projects','sentry_import_targets'].includes(table)&&row.project!==null&&!projects.has(row.project))throw new Error('Archive project reference');
    if(row.issue && (issues.get(row.issue) as any)?.project!==row.project)throw new Error('Archive issue reference');
  }
  validateIssueReleases(data);
  const originals=await validateOperators(data);
  const occurrenceCounts=new Map<string,number>();for(const e of v.data.events)occurrenceCounts.set(e.issue,(occurrenceCounts.get(e.issue)??0)+1);
  for(const row of v.data.issues){safeText(row.title);if(!/^[a-f0-9]{64}$/.test(row.id)||!/^[a-f0-9]{64}$/.test(row.fingerprint)||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error('Archive issue identity');if(!['open','acknowledged','resolved','suppressed'].includes(row.state)||!['js-frame-v1','sentry-import-v1'].includes(row.algorithm)||!Number.isSafeInteger(row.count)||row.count<0)throw new Error('Archive issue state');const count=occurrenceCounts.get(row.id)??0;if(count!==row.count)throw new Error('Archive aggregate mismatch');}
  for(const row of v.data.events){validateOccurrence(row.occurrence);const event=normalize(JSON.parse(row.payload));if(JSON.stringify(event)!==row.payload||event.eventId!==row.id||event.release!==row.release||event.build!==row.build||event.environment!==row.environment||!/^[a-f0-9]{64}$/.test(row.digest))throw new Error('Archive event integrity');const r:any=releases.get(row.project+':'+row.release);if(!r||r.seq!==row.release_seq||r.build!==row.build)throw new Error('Archive release reference');if(row.historical){importedDiagnostic(JSON.parse(row.diagnostic),event);continue}diagnostic(JSON.parse(row.diagnostic),event);const basis=JSON.stringify([event.type,event.frames[0].file,event.frames[0].function,event.frames[0].line]);const fingerprint=await hash(basis);if(!originals.has(JSON.stringify([row.project,row.id,row.occurrence]))&&((issues.get(row.issue) as any).fingerprint!==fingerprint||await hash(row.project+':'+fingerprint)!==row.issue))throw new Error('Archive grouping mismatch');}
  for(const row of v.data.artifacts){validateOccurrence(row.occurrence);const payload=validateMap(JSON.parse(row.payload));if(payload!==row.payload||await hash(payload)!==row.digest)throw new Error('Archive artifact integrity');const r:any=releases.get(row.project+':'+row.release);if(!r||r.build!==row.build)throw new Error('Archive artifact release');}
  for(const row of v.data.outcomes)if(!['accepted','duplicate','conflict','unauthorized','invalid','oversized','rejected','rate_limited','budget','storage_failure','unregistered_release_or_build','missing_release_register_required','sentry_unsupported_session','sentry_unsupported_performance','sentry_unsupported_attachment','sentry_unsupported_client_report','sentry_unsupported_replay','sentry_unsupported_profile','sentry_unsupported_feedback','sentry_unsupported_check_in','sentry_unsupported_other_telemetry','sentry_unsupported_unknown',...EXPOSURE_LOSS].includes(row.reason)||!Number.isSafeInteger(row.count)||row.count<0||!Number.isSafeInteger(row.window))throw new Error('Archive loss accounting');
  for(const row of v.data.alerts)if(!['new_issue','regression'].includes(row.kind)||!Number.isSafeInteger(row.created))throw new Error('Archive alert');
  const kinds:Record<string,string[]>={project_created:['id'],release_registered:['name','build','seq'],key_created:['hash','kind'],key_revoked:['hash'],triage:['issue','state','revision'],artifact_uploaded:['release','build','debug','digest'],retention_gap:['cutoff','removed','dedupHorizon'],...legacy?{}:{browser_origin_added:['origin'],browser_origin_removed:['origin']}};
  for(const row of v.data.audit.filter((r:any)=>!operatorAuditKinds.includes(r.kind))){if(!kinds[row.kind]||!Number.isSafeInteger(row.created))throw new Error('Archive audit kind');const detail=JSON.parse(row.detail);shape(detail,kinds[row.kind]);for(const [field,value] of Object.entries(detail)){if(field==='origin'&&row.kind.startsWith('browser_origin_')){if(typeof row.project!=='string'||!projects.has(row.project))throw new Error('Archive origin audit project');browserOrigin(value);}else if(typeof value==='string')safeText(value);else if(typeof value!=='number'||!Number.isSafeInteger(value))throw new Error('Archive audit value');}}
  const originIdentities=new Set<string>();
  if(!legacy)for(const row of v.data.browser_origins){if(typeof row.project!=='string'||!projects.has(row.project))throw new Error('Archive origin project');browserOrigin(row.origin);const key=row.project+'\n'+row.origin;if(originIdentities.has(key))throw new Error('Archive duplicate origin');originIdentities.add(key);if(!Number.isSafeInteger(row.created)||row.created<0)throw new Error('Archive origin timestamp');}
  for(const project of projects){if(v.data.events.filter((r:any)=>r.project===project).length>10000)throw new Error('Archive event budget');if(!legacy&&v.data.browser_origins.filter((r:any)=>r.project===project).length>20)throw new Error('Archive origin budget');if(v.data.artifacts.filter((r:any)=>r.project===project).length>20)throw new Error('Archive artifact budget');}
  await validateImportedRows(v.data);
  return {...v.data,browser_origins:legacy?[]:v.data.browser_origins};
}
