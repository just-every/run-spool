import {guard} from '../modules/portability/storage.mjs';
import {hash,canonical,scrub} from './privacy';
export const retentionTypes=['events','artifacts','feedback','exposures','commits','sessions'] as const;
export type RetentionType=typeof retentionTypes[number];
export type RetentionWindows=Record<RetentionType,number>;
export const defaultRetentionWindows=()=>Object.fromEntries(retentionTypes.map(k=>[k,90])) as RetentionWindows;
export function retentionWindows(value:any):RetentionWindows {
 if(!value||Array.isArray(value)||Object.keys(value).sort().join()!==[...retentionTypes].sort().join()||retentionTypes.some(k=>!Number.isSafeInteger(value[k])||value[k]<30||value[k]>90))throw new Error('Retention windows must be 30 to 90 whole days for every data type');
 return Object.fromEntries(retentionTypes.map(k=>[k,value[k]])) as RetentionWindows;
}
export async function readRetentionPolicy(db:D1Database,project:string){
 const row=await db.prepare('SELECT * FROM retention_policies WHERE project=?').bind(project).first<any>();
 return row?{revision:row.revision,generation:row.generation,windows:retentionWindows(JSON.parse(row.windows)),held:!!row.held,reason:scrub(row.reason),updated:row.updated}:{revision:0,generation:null,windows:defaultRetentionWindows(),held:false,reason:'',updated:null};
}
export const retentionPolicyFence=(db:D1Database,project:string,generation:string|null)=>guard(db,"COALESCE((SELECT generation FROM retention_policies WHERE project=?),'')=?",project,generation??'');
export const retentionCutoffs=(windows:RetentionWindows,at:number)=>Object.fromEntries(retentionTypes.map(k=>[k,Math.max(0,at-windows[k]*86400000)])) as RetentionWindows;
function retentionSpecifications(cutoffs:RetentionWindows){
 return {
 events:['events','received','received<?',[cutoffs.events],'length(CAST(payload AS BLOB))'],
 artifacts:['artifacts','created',`created<? AND NOT EXISTS(SELECT 1 FROM events e WHERE e.project=artifacts.project AND e.release=artifacts.release AND e.build=artifacts.build AND e.received>=?)`,[cutoffs.artifacts,cutoffs.events],'length(CAST(payload AS BLOB))'],
 feedback:['feedback','received',`received<? OR EXISTS(SELECT 1 FROM events e WHERE e.project=feedback.project AND e.id=feedback.event_id AND e.occurrence=feedback.occurrence AND e.received<?)`,[cutoffs.feedback,cutoffs.events],'length(CAST(message AS BLOB))'],
 exposures:['exposures','last','last<?',[cutoffs.exposures],'128'],
 commits:['commits','received','(received<? AND expired IS NULL AND COALESCE(message,author_name,author_email) IS NOT NULL) OR EXISTS(SELECT 1 FROM suspect_commit_files f WHERE f.project=commits.project AND f.sha=commits.sha AND f.received<?)',[cutoffs.commits,cutoffs.commits],'COALESCE(length(CAST(message AS BLOB)),0)+COALESCE(length(CAST(author_name AS BLOB)),0)+COALESCE(length(CAST(author_email AS BLOB)),0)+COALESCE((SELECT length(CAST(files AS BLOB)) FROM suspect_commit_files f WHERE f.project=commits.project AND f.sha=commits.sha),0)'],
 sessions:['health_sessions','updated','updated<?',[cutoffs.sessions],'192'],
 } as const;
}
export async function retentionPreview(db:D1Database,project:string,windows:RetentionWindows,at=Date.now()){
 if(!Number.isSafeInteger(at)||at<0||at>Date.now()||Date.now()-at>300000)throw new Error('Preview expired; preview again');
 const current=await readRetentionPolicy(db,project),cutoffs=retentionCutoffs(windows,at);
 const specifications=retentionSpecifications(cutoffs);
 const rows=await Promise.all(retentionTypes.map(async type=>{const [table,time,where,values,bytes]=specifications[type];const row=await db.prepare(`SELECT COUNT(*) count,MIN(${time}) oldest,MAX(${time}) newest,COALESCE(SUM(${bytes}),0) bytes FROM ${table} WHERE project=? AND (${where})`).bind(project,...values).first<any>();return {type,cutoff:cutoffs[type],...row}}));
 const total=await Promise.all(retentionTypes.map(async type=>{const [table,,,,bytes]=specifications[type];return await db.prepare(`SELECT COALESCE(SUM(${bytes}),0) bytes FROM ${table} WHERE project=?`).bind(project).first<any>()}));
 const data={project,revision:current.revision,generation:current.generation,at,windows,held:current.held,rows,shortening:retentionTypes.some(k=>windows[k]<current.windows[k]),coverage:'Evidence before each cutoff is unavailable; historical comparisons and retry deduplication can be incomplete.',storage:{estimatedBytes:total.reduce((n,r)=>n+r.bytes,0),selectedBytes:rows.reduce((n,r)=>n+r.bytes,0),basis:'Stored text bytes plus estimated structured rows; excludes indexes, database overhead, artifacts referenced by retained events and session aggregates.'}};
 return {...data,token:await hash(canonical(data))};
}
// Counts, range and selected bytes are checked again inside the policy write.
export function retentionPreviewFences(db:D1Database,project:string,preview:any){
 const specifications=retentionSpecifications(retentionCutoffs(preview.windows,preview.at));
 return preview.rows.map((row:any)=>{const [table,time,where,values,bytes]=specifications[row.type as RetentionType];return guard(db,`EXISTS(SELECT 1 FROM (SELECT COUNT(*) count,MIN(${time}) oldest,MAX(${time}) newest,COALESCE(SUM(${bytes}),0) bytes FROM ${table} WHERE project=? AND (${where})) WHERE count=? AND oldest IS ? AND newest IS ? AND bytes=?)`,project,...values,row.count,row.oldest,row.newest,row.bytes)});
}
export const retentionTables={retention_policies:['project','generation','revision','windows','held','reason','updated']};
export function validateRetentionArchive(data:any){
 const seen=new Set();for(const row of data.retention_policies){const windows=retentionWindows(JSON.parse(row.windows));if(seen.has(row.project)||!data.projects.some((p:any)=>p.id===row.project)||typeof row.generation!=='string'||!/^[-a-f0-9]{36}$/.test(row.generation)||!Number.isSafeInteger(row.revision)||row.revision<1||JSON.stringify(windows)!==row.windows||![0,1].includes(row.held)||typeof row.reason!=='string'||row.reason.length>1000||scrub(row.reason)!==row.reason||row.held&&!row.reason.trim()||!Number.isSafeInteger(row.updated)||row.updated<0)throw new Error('Archive retention policy');seen.add(row.project)}
}
