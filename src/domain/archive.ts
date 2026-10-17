import {inboundFilterTables,inboundFilterDefaults,validateInboundFilterArchive,inboundAuditKinds,inboundFilteredReasons} from './filters/archive';
import { bundleTables, bundleDefaults, validateBundleRoutes, admissionBasis } from './bundle-grouping';
import { pathMappings } from './path-mappings';
import { operatorTables, operatorDefaults, operatorAuditKinds, validateOperators } from './operators/archive';
import { grouping, hash, canonical, normalize, identity, scrub } from './privacy';
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
  outcomes:['project','window','reason','count'],audit:['id','project','kind','detail','created'],alerts:['id','project','issue','kind','created'],browser_origins:['project','origin','created'],...importedTables,...operatorTables,...bundleTables,...inboundFilterTables
};
function shape(value:any, fields:string[]){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...fields].sort().join())throw new Error('Archive derived field shape');}
function safeText(value:any){if(typeof value!=='string'||scrub(value)!==value)throw new Error('Archive unsanitized text');}
function frame(value:any,language?:any){shape(value,Object.prototype.hasOwnProperty.call(value??{},'debugId')?['file','line','column','function','debugId']:['file','line','column','function']);const normalized=normalize({version:1,...(language?{language}:{}),eventId:'validation',release:'validation',build:'validation',environment:'validation',type:'Error',message:'',frames:[value],breadcrumbs:[]}).frames[0];if(canonical(normalized)!==canonical(value))throw new Error('Archive unsanitized frame');}
function diagnostic(value:any,event:any,data:any,project:string){
 if(!Array.isArray(value)||value.length!==event.frames.length)throw new Error('Archive diagnostic');
 for(let i=0;i<value.length;i++){
  const d=value[i],language=event.language;
  const statuses=language==='python'?['python_source']:language==='go'?['go_mapping_unavailable','go_path_unmatched','go_path_mapped']:['missing_debug_id','missing_artifact','identity_mismatch','unmapped_position','mapped','invalid_artifact'];
  if(!d||!statuses.includes(d.status))throw new Error('Archive diagnostic status');
  const fields=['generated','status'];if(['mapped','unmapped_position','invalid_artifact'].includes(d.status))fields.push('artifactDigest');if(d.status==='mapped')fields.push('original');
  if(d.status==='python_source')fields.push('source');
  if(d.status==='go_path_mapped')fields.push('source','original','mapping');
  shape(d,fields);frame(d.generated,language);if(canonical(d.generated)!==canonical(event.frames[i]))throw new Error('Archive generated frame mismatch');
  if('artifactDigest' in d && !/^[a-f0-9]{64}$/.test(d.artifactDigest))throw new Error('Archive diagnostic digest');
  if(d.original){shape(d.original,['file','line','column','function']);frame(d.original,language);}
  if(d.status==='python_source'&&d.source!=='reported_source_path')throw new Error('Archive source provenance');
  if(d.status==='go_path_mapped'){
   shape(d.mapping,['from','to','repository','commitSha','release','build','environment']);
   const m=d.mapping,record=data.deployment_path_mappings.find((r:any)=>r.project===project&&r.release===event.release&&r.build===event.build&&r.environment===event.environment),manifest=data.deployment_manifests.find((r:any)=>r.project===project&&r.release===event.release&&r.environment===event.environment);
   const matches=record?pathMappings(JSON.parse(record.payload)).filter(p=>d.generated.file===p.from||d.generated.file.startsWith(p.from+'/')).sort((a,b)=>b.from.length-a.from.length):[];
   if(!matches.length||m.from!==matches[0].from||m.to!==matches[0].to||m.repository!==manifest?.repository||m.commitSha!==manifest?.commit_sha||m.release!==event.release||m.build!==event.build||m.environment!==event.environment||d.source!=='owner_or_deploy_key_recorded'||d.original.file!==(m.to==='.'?d.generated.file.slice(m.from.length+1)||'.':m.to+d.generated.file.slice(m.from.length))||d.original.line!==d.generated.line||d.original.column!==d.generated.column||d.original.function!==d.generated.function||(d.original.file!=='.'&&/(^|\/)\.{1,2}(\/|$)/.test(d.original.file)))throw new Error('Archive mapping provenance');
  }
 }
}
export async function validateArchive(v:any) {
  shape(v,['version','migration','data','checksum']);
  const legacy=v.version===1&&v.migration==='0001_errors';
  if(!v || (!legacy&&(v.version!==2||v.migration!=='0003_browser_origins'))||!v.data||await hash(canonical({version:v.version,migration:v.migration,data:v.data}))!==v.checksum)throw new Error('Archive identity/checksum mismatch');
  const oldTables=Object.fromEntries(Object.entries(tables).filter(([name])=>!Object.hasOwn(importedTables,name)&&!Object.hasOwn(operatorTables,name)&&!Object.hasOwn(bundleTables,name)&&!Object.hasOwn(inboundFilterTables,name)).map(([name,fields])=>[name,fields.filter(field=>!['historical','occurrence','latest_release_seq'].includes(field))]));
  const inputTables=legacy?Object.fromEntries(Object.entries(oldTables).filter(([name])=>name!=='browser_origins')):oldTables;
  if(Object.keys(v.data).sort().join()!==Object.keys(inputTables).sort().join())throw new Error('Archive tables mismatch');
  for(const [table,fields] of Object.entries(inputTables)) {
    const rows=v.data[table];if(!Array.isArray(rows)||rows.length>10000)throw new Error('Archive row budget');
    for(const row of rows){if(!row||Object.keys(row).sort().join()!==[...fields].sort().join()||Object.values(row).some(x=>x!==null&&typeof x!=='string'&&typeof x!=='number')||Object.entries(row).some(([key,x])=>typeof x==='string'&&x.length>(table==='events'&&key==='payload'?4*1024*1024:300000)))throw new Error('Archive row shape');}
  }
  const upgraded=Object.fromEntries(Object.entries(v.data).map(([table,rows])=>[table,(rows as Record<string,unknown>[]).map(row=>upgradeOccurrence(table,row))]));
  return validateArchiveRows(inboundFilterDefaults(bundleDefaults(operatorDefaults(legacyIssueReleases(legacyImportDefaults({...upgraded,browser_origins:legacy?[]:v.data.browser_origins}))))),legacy);
}
export async function validateArchiveRows(data:any,legacy=false) {
  const v={data};
  if(Object.keys(data).sort().join()!==Object.keys(tables).sort().join())throw new Error('Archive tables mismatch');
  for(const [table,fields] of Object.entries(tables)) {
    if(!Array.isArray(data[table]))throw new Error('Archive row budget');
    for(const row of data[table]){shape(row,fields);if(Object.values(row).some(x=>x!==null&&typeof x!=='string'&&typeof x!=='number')||Object.entries(row).some(([key,x])=>typeof x==='string'&&x.length>(table==='events'&&key==='payload'?4*1024*1024:300000)))throw new Error('Archive row shape');}
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
  await validateBundleRoutes(data);
  const originals=await validateOperators(data);
  const occurrenceCounts=new Map<string,number>();for(const e of v.data.events)occurrenceCounts.set(e.issue,(occurrenceCounts.get(e.issue)??0)+1);
  for(const row of v.data.issues){safeText(row.title);if(!/^[a-f0-9]{64}$/.test(row.id)||!/^[a-f0-9]{64}$/.test(row.fingerprint)||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error('Archive issue identity');if(!['open','acknowledged','resolved','suppressed'].includes(row.state)||!['js-frame-v1','python-frame-v1','go-frame-v1','sentry-chain-v1','sentry-import-v1'].includes(row.algorithm)||!Number.isSafeInteger(row.count)||row.count<0)throw new Error('Archive issue state');const count=occurrenceCounts.get(row.id)??0;if(count!==row.count)throw new Error('Archive aggregate mismatch');}
  for(const row of v.data.events){validateOccurrence(row.occurrence);const event=normalize(JSON.parse(row.payload));if(JSON.stringify(event)!==row.payload||event.eventId!==row.id||event.release!==row.release||event.build!==row.build||event.environment!==row.environment||!/^[a-f0-9]{64}$/.test(row.digest))throw new Error('Archive event integrity');const r:any=releases.get(row.project+':'+row.release);if(!r||r.seq!==row.release_seq||r.build!==row.build)throw new Error('Archive release reference');if(row.historical){importedDiagnostic(JSON.parse(row.diagnostic),event);continue}diagnostic(JSON.parse(row.diagnostic),event,data,row.project);const basis=await admissionBasis(event,issues.get(row.issue) as any,data.grouping_routes);const fingerprint=await hash(basis);if(!originals.has(JSON.stringify([row.project,row.id,row.occurrence]))&&((issues.get(row.issue) as any).algorithm!==grouping(event).algorithm||(issues.get(row.issue) as any).fingerprint!==fingerprint||await hash(row.project+':'+fingerprint)!==row.issue))throw new Error('Archive grouping mismatch');}
  for(const row of v.data.artifacts){validateOccurrence(row.occurrence);const payload=validateMap(JSON.parse(row.payload));if(payload!==row.payload||await hash(payload)!==row.digest)throw new Error('Archive artifact integrity');const r:any=releases.get(row.project+':'+row.release);if(!r||r.build!==row.build)throw new Error('Archive artifact release');}
  for(const row of v.data.outcomes)if(!['accepted','filtered',...inboundFilteredReasons,'duplicate','conflict','unauthorized','invalid','oversized','rejected','rate_limited','budget','storage_failure','unregistered_release_or_build','missing_release_register_required','sentry_unsupported_session','sentry_unsupported_performance','sentry_unsupported_attachment','sentry_unsupported_client_report','sentry_unsupported_replay','sentry_unsupported_profile','sentry_unsupported_feedback','sentry_unsupported_check_in','sentry_unsupported_other_telemetry','sentry_unsupported_unknown','sentry_trimmed_frames','sentry_trimmed_values',...EXPOSURE_LOSS].includes(row.reason)||!Number.isSafeInteger(row.count)||row.count<0||!Number.isSafeInteger(row.window))throw new Error('Archive loss accounting');
  for(const row of v.data.alerts)if(!['new_issue','regression'].includes(row.kind)||!Number.isSafeInteger(row.created))throw new Error('Archive alert');
  const kinds:Record<string,string[]>={project_created:['id'],release_registered:['name','build','seq'],key_created:['hash','kind'],key_revoked:['hash'],triage:['issue','state','revision'],artifact_uploaded:['release','build','debug','digest'],retention_gap:['cutoff','removed','dedupHorizon'],...legacy?{}:{browser_origin_added:['origin'],browser_origin_removed:['origin']}};
  for(const row of v.data.audit.filter((r:any)=>!operatorAuditKinds.includes(r.kind)&&!inboundAuditKinds.includes(r.kind))){if(!kinds[row.kind]||!Number.isSafeInteger(row.created))throw new Error('Archive audit kind');const detail=JSON.parse(row.detail);shape(detail,kinds[row.kind]);for(const [field,value] of Object.entries(detail)){if(field==='origin'&&row.kind.startsWith('browser_origin_')){if(typeof row.project!=='string'||!projects.has(row.project))throw new Error('Archive origin audit project');browserOrigin(value);}else if(typeof value==='string')safeText(value);else if(typeof value!=='number'||!Number.isSafeInteger(value))throw new Error('Archive audit value');}}
  const originIdentities=new Set<string>();
  if(!legacy)for(const row of v.data.browser_origins){if(typeof row.project!=='string'||!projects.has(row.project))throw new Error('Archive origin project');browserOrigin(row.origin);const key=row.project+'\n'+row.origin;if(originIdentities.has(key))throw new Error('Archive duplicate origin');originIdentities.add(key);if(!Number.isSafeInteger(row.created)||row.created<0)throw new Error('Archive origin timestamp');}
  for(const project of projects){if(v.data.events.filter((r:any)=>r.project===project).length>10000)throw new Error('Archive event budget');if(!legacy&&v.data.browser_origins.filter((r:any)=>r.project===project).length>20)throw new Error('Archive origin budget');if(v.data.artifacts.filter((r:any)=>r.project===project).length>20)throw new Error('Archive artifact budget');}
  await validateInboundFilterArchive(v.data);
  await validateImportedRows(v.data);
  return {...v.data,browser_origins:legacy?[]:v.data.browser_origins};
}
