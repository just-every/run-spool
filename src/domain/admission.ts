import { policyMatch, matchArgs } from './operators/policies';
import { normalize, hash, scrub, type Envelope } from './privacy';
import { captureGrouping } from './bundle-grouping';
import { diagnose } from './artifacts';
import { ingestOrigin } from './origins';
import { admissionAlerts, receivedAtSql } from './alerts/admission';
import { startCaptureHistory, rememberUnsuppressedCapture } from './alerts/capture-history';
import { dispatchAdmitted } from './alerts/dispatch';
import { mintAdmission } from './dev-credentials';
export const stmt=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
export interface IngestScope { project:string; keyHash:string; foreign:string|null }
export async function authorizeIngest(c:any,project:string,key:string|undefined):Promise<{scope:IngestScope}|{response:Response}>{
  c.header('Vary','Origin');
  const policy=await ingestOrigin(c.env.DB,project,c.req.header('origin'),c.env.AUTH_ORIGIN);
  if(!policy.allowed)return {response:c.json({outcome:'rejected',reason:'origin_not_allowed'},403)};
  if(policy.cors)c.header('Access-Control-Allow-Origin',policy.cors);
  const keyHash=key?await hash(key):'';
  const grant=keyHash&&await stmt(c.env.DB,`SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='ingest' AND revoked IS NULL AND ${await mintAdmission(c.req.raw)}`,keyHash,project).first();
  if(!grant)return {response:c.json({outcome:'rejected',reason:'invalid_ingest_key'},401)};
  return {scope:{project,keyHash,foreign:policy.foreign}};
}
function authority(c:any,scope:IngestScope){
  return stmt(c.env.DB,"INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='ingest' AND revoked IS NULL) AND (? IS NULL OR EXISTS(SELECT 1 FROM browser_origins WHERE project=? AND origin=?)) THEN 1 ELSE 0 END",scope.keyHash,scope.project,scope.foreign,scope.project,scope.foreign);
}
export async function ingestBatch(c:any,scope:IngestScope,jobs:D1PreparedStatement[]){
  return c.env.DB.batch([authority(c,scope),...jobs,authority(c,scope),stmt(c.env.DB,'DELETE FROM spool_authority_guards')]);
}
export function outcomeStatement(db:D1Database,project:string,reason:string,count=1){return stmt(db,'INSERT INTO outcomes VALUES(?,?,?,?) ON CONFLICT(project,window,reason) DO UPDATE SET count=count+excluded.count',project,Math.floor(Date.now()/60000)*60000,reason,count)}
export async function recordIngest(c:any,scope:IngestScope,reason:string,count=1){await ingestBatch(c,scope,[outcomeStatement(c.env.DB,scope.project,reason,count)])}
export async function ingestFailure(c:any,scope:IngestScope,error:unknown){
  const message=String((error as Error).message);
  const policy=await ingestOrigin(c.env.DB,scope.project,c.req.header('origin'),c.env.AUTH_ORIGIN);
  if(!policy.allowed){c.header('Access-Control-Allow-Origin',undefined);return c.json({outcome:'rejected',reason:'origin_not_allowed'},403)};
  const grant=await stmt(c.env.DB,`SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='ingest' AND revoked IS NULL AND ${await mintAdmission(c.req.raw)}`,scope.keyHash,scope.project).first();
  if(!grant)return c.json({outcome:'rejected',reason:'invalid_ingest_key'},401);
  if(message.includes('spool_authority_guards')||message.includes('CHECK constraint failed'))return c.json({outcome:'rejected',reason:'ingest_authority_changed'},403);
  if(message.includes('minute_budget')||message.includes('retained_event_budget')){
    const reason=message.includes('minute_budget')?'minute_budget':'retained_event_budget';c.header('Retry-After','60');
    await recordIngest(c,scope,reason==='minute_budget'?'rate_limited':'budget');return c.json({outcome:'dropped',reason,retryAfter:60},429);
  }
  return c.json({outcome:'unavailable',reason:'transaction_not_confirmed'},503);
}
function sentryTrimming(db:D1Database,project:string,event:Envelope){
 const notes=event.sentry?.truncation??[],frames=notes.filter(n=>['middle_frames','invalid_frames'].includes(n.reason)).reduce((sum,n)=>sum+(n.omitted??0),0),values=notes.filter(n=>['value_bytes','value_depth'].includes(n.reason)).length;
 return [...(frames?[outcomeStatement(db,project,'sentry_trimmed_frames',frames)]:[]),...(values?[outcomeStatement(db,project,'sentry_trimmed_values',values)]:[])];
}
/** The sole native/Sentry admission transaction. Import history never calls this. */
export async function admitEvent(c:any,scope:IngestScope,input:Envelope,digest:string):Promise<Response>{
  const event=normalize(input),{project}=scope,db=c.env.DB;
  const record=(reason:string)=>recordIngest(c,scope,reason);
  const duplicate=async(row:any)=>{await record(row.digest===digest?'duplicate':'conflict');return c.json({outcome:row.digest===digest?'duplicate':'conflict',issue:row.issue},row.digest===digest?200:409)};
  try{
    const existing=await stmt(db,'SELECT digest,issue FROM events WHERE project=? AND id=?',project,event.eventId).first<any>();
    if(existing)return await duplicate(existing);
    const budget=await stmt(db,"SELECT COALESCE(SUM(count),0) total FROM outcomes WHERE project=? AND window>=? AND reason IN ('accepted','rejected','invalid','oversized','rate_limited','budget','unregistered_release_or_build','missing_release_register_required')",project,Math.floor(Date.now()/60000)*60000).first<any>();
    if(budget.total>=120){await record('rate_limited');c.header('Retry-After','60');return c.json({outcome:'dropped',reason:'minute_budget',retryAfter:60},429)}
    const release=await stmt(db,'SELECT seq,build FROM releases WHERE project=? AND name=?',project,event.release).first<any>();
    if(!release||release.build!==event.build){await record('unregistered_release_or_build');return c.json({outcome:'rejected',reason:'unregistered_release_or_build',register:`/projects/${encodeURIComponent(project)}/releases`},422)}
    const count=await stmt(db,'SELECT COUNT(*) total FROM events WHERE project=?',project).first<any>();
    if(count.total>=10000){await record('budget');return c.json({outcome:'dropped',reason:'retained_event_budget'},429)}
    const {algorithm,basis,fingerprint,route}=await captureGrouping(db,project,event),issue=await hash(project+':'+fingerprint);
    const diagnosis=JSON.stringify(await diagnose(db,project,event)),time=Date.now(),originGuard=scope.foreign?crypto.randomUUID():null,alertId=crypto.randomUUID(),occurrence=crypto.randomUUID();
    const jobs=[
      ...(originGuard?[stmt(db,'INSERT INTO browser_origin_guards VALUES(?,?,?)',originGuard,project,scope.foreign)]:[]),
      stmt(db,"INSERT INTO issues(id,project,fingerprint,algorithm,title,state,revision,count,first_seen,last_seen) VALUES(?,?,?,?,?,'open',0,0,?,?) ON CONFLICT(id) DO NOTHING",issue,project,fingerprint,algorithm,scrub(event.type+': '+event.message),time,time),
      ...(route?[
       stmt(db,'INSERT INTO grouping_routes VALUES(?,?,?,?) ON CONFLICT(project,fingerprint) DO NOTHING',project,route.fingerprint,issue,basis),
       stmt(db,'INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM grouping_routes WHERE project=? AND fingerprint=? AND issue=? AND basis=?) THEN 1 ELSE 0 END',project,route.fingerprint,issue,basis),
      ]:[]),
      startCaptureHistory(db,project,issue,time),
      stmt(db,`INSERT INTO events(id,project,issue,release,release_seq,build,environment,payload,digest,diagnostic,received,occurrence,historical) VALUES(?,?,?,?,?,?,?,?,?,?,${receivedAtSql},?,0)`,event.eventId,project,issue,event.release,release.seq,event.build,event.environment,JSON.stringify(event),digest,diagnosis,occurrence),
      stmt(db,`INSERT INTO event_suppressions SELECT e.project,e.id,e.occurrence,(SELECT json_group_array(json_object('id',p.id,'revision',p.revision,'field',p.field,'mode',p.mode,'value',p.value)) FROM suppression_policies p WHERE ${policyMatch}) FROM events e WHERE e.project=? AND e.id=? AND EXISTS(SELECT 1 FROM suppression_policies p WHERE ${policyMatch})`,...matchArgs(project,fingerprint,event.release,event.message),project,event.eventId,...matchArgs(project,fingerprint,event.release,event.message)),
      ...admissionAlerts(db,{alertId,project,issue,eventId:event.eventId,occurrence,release:event.release,build:event.build,sequence:release.seq,time,origin:c.env.ALERT_PUBLIC_ORIGIN??c.env.AUTH_ORIGIN}),
      rememberUnsuppressedCapture(db,project,issue,event.eventId,occurrence,time),
      stmt(db,"UPDATE issues SET count=count+1,last_seen=?,revision=revision+1,state=CASE WHEN state='resolved' AND latest_release_seq IS NOT NULL AND ?>resolved_seq AND NOT EXISTS(SELECT 1 FROM event_suppressions receipt WHERE receipt.project=? AND receipt.event=? AND receipt.occurrence=?) THEN 'open' ELSE state END WHERE id=?",time,release.seq,project,event.eventId,occurrence,issue),
      outcomeStatement(db,project,'accepted'),
      ...sentryTrimming(db,project,event),
      ...(originGuard?[stmt(db,'DELETE FROM browser_origin_guards WHERE id=?',originGuard)]:[]),
    ];
    try{await ingestBatch(c,scope,jobs)}catch(error){const retry=await stmt(db,'SELECT digest,issue FROM events WHERE project=? AND id=?',project,event.eventId).first<any>();if(retry)return await duplicate(retry);throw error}
    // New-issue and regression alerts go out now; the scheduled run remains the path for spikes and anything left queued.
    c.executionCtx.waitUntil(dispatchAdmitted(c.env,alertId));
    return c.json({outcome:'accepted',issue,algorithm,basis:JSON.parse(basis),diagnostic:JSON.parse(diagnosis)},201);
  }catch(error){return ingestFailure(c,scope,error)}
}
