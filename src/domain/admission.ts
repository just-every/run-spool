import {eventIdentityStatements,type PreparedIdentity} from './identities/intake';
import { auditedBatch } from './audit/context';
import { prepareRelease } from './releases/admission';
import { regressionSql,newerReleaseSql } from './releases/order';
import { readGroupingPolicy,groupingPolicyFence } from './grouping/policy';
import {readInboundPolicy,inboundPolicyFence,matchInbound,inboundMetadata,inboundDomainFences,type InboundPolicy,type DomainDecision} from './filters';
import { policyMatch, matchArgs } from './operators/policies';
import { normalize, hash, scrub, type Envelope } from './privacy';
import { captureGrouping } from './bundle-grouping';
import { diagnose } from './artifacts';
import { ingestOrigin } from './origins';
import { admissionAlerts, receivedAtSql } from './alerts/admission';
import { startCaptureHistory, rememberUnsuppressedCapture } from './alerts/capture-history';
import { dispatchAdmitted } from './alerts/dispatch';
import { mintAdmission } from './dev-credentials';
import { mintedByCurrentPerson } from './credential-fence';
import { assignShortId } from './short-ids/assign';
export const stmt=(db:D1Database,sql:string,...args:any[])=>db.prepare(sql).bind(...args);
export interface IngestScope { project:string; keyHash:string; foreign:string|null; revision:number; policy:InboundPolicy; domain:DomainDecision }
export async function authorizeIngest(c:any,project:string,key:string|undefined):Promise<{scope:IngestScope}|{response:Response}>{
  c.header('Vary','Origin');
  const policy=await ingestOrigin(c.env.DB,project,c.req.header('origin'),c.env.AUTH_ORIGIN,c.req.header('referer'));

  if(policy.allowed&&policy.cors)c.header('Access-Control-Allow-Origin',policy.cors);
  const keyHash=key?await hash(key):'';
  const grant=keyHash&&await stmt(c.env.DB,`SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='ingest' AND revoked IS NULL AND ${mintedByCurrentPerson} AND ${await mintAdmission(c.req.raw)}`,keyHash,project).first();
  if(!grant)return {response:policy.allowed?c.json({outcome:'rejected',reason:'invalid_ingest_key'},401):c.json({outcome:'rejected',reason:policy.domain.reason},403)};
  const scope={project,keyHash,foreign:policy.foreign,revision:policy.revision,policy:policy.policy,domain:policy.domain};
  if(!policy.allowed){await ingestBatch(c,scope,[outcomeStatement(c.env.DB,project,'filtered'),outcomeStatement(c.env.DB,project,'filtered:allowed_domains')]);return {response:c.json({outcome:'filtered',reason:policy.domain.reason,filters:['allowed_domains']},403)}}
  if(policy.cors)c.header('Access-Control-Allow-Origin',policy.cors);
  return {scope};
}
function authority(c:any,scope:IngestScope){
  return stmt(c.env.DB,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='ingest' AND revoked IS NULL AND ${mintedByCurrentPerson}) AND (? IS NULL OR EXISTS(SELECT 1 FROM browser_origins WHERE project=? AND origin=?)) THEN 1 ELSE 0 END`,scope.keyHash,scope.project,scope.foreign,scope.project,scope.foreign);
}
export async function ingestBatch(c:any,scope:IngestScope,jobs:D1PreparedStatement[]){
  return auditedBatch(c.env.DB,[authority(c,scope),inboundPolicyFence(c.env.DB,scope.project,scope.revision),...inboundDomainFences(c.env.DB,scope.project,scope.domain),...jobs,authority(c,scope),stmt(c.env.DB,'DELETE FROM spool_authority_guards')]);
}
export function outcomeStatement(db:D1Database,project:string,reason:string,count=1){return stmt(db,'INSERT INTO outcomes VALUES(?,?,?,?) ON CONFLICT(project,window,reason) DO UPDATE SET count=count+excluded.count',project,Math.floor(Date.now()/60000)*60000,reason,count)}
export async function recordIngest(c:any,scope:IngestScope,reason:string,count=1){await ingestBatch(c,scope,[outcomeStatement(c.env.DB,scope.project,reason,count)])}
export async function ingestFailure(c:any,scope:IngestScope,error:unknown){
  const message=String((error as Error).message);
  const policy=await ingestOrigin(c.env.DB,scope.project,c.req.header('origin'),c.env.AUTH_ORIGIN,c.req.header('referer'));
  if(!policy.allowed){c.header('Access-Control-Allow-Origin',undefined);return c.json({outcome:'rejected',reason:policy.domain.reason},403)};
  if(policy.revision!==scope.revision)return c.json({outcome:'rejected',reason:'inbound_policy_changed'},409);
  const grant=await stmt(c.env.DB,`SELECT 1 FROM credentials WHERE hash=? AND project=? AND kind='ingest' AND revoked IS NULL AND ${mintedByCurrentPerson} AND ${await mintAdmission(c.req.raw)}`,scope.keyHash,scope.project).first();
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
export async function admitEvent(c:any,scope:IngestScope,input:Envelope,digest:string,sentryIntake=false,identity?:PreparedIdentity):Promise<Response>{
  let event=normalize(input);const {project}=scope,db=c.env.DB;
  const record=(reason:string)=>recordIngest(c,scope,reason);
  const duplicate=async(row:any)=>{await record(row.digest===digest?'duplicate':'conflict');return c.json({outcome:row.digest===digest?'duplicate':'conflict',issue:row.issue},row.digest===digest?200:409)};
  try{
    const matches=matchInbound(event,scope.policy,inboundMetadata(event,{origin:c.req.header('origin'),referer:c.req.header('referer'),userAgent:c.req.header('user-agent'),clientIp:c.req.header('cf-connecting-ip'),domainAllowed:scope.domain.allowed}));
    if(matches.length){await ingestBatch(c,scope,[outcomeStatement(db,project,'filtered'),...matches.map(id=>outcomeStatement(db,project,'filtered:'+id))]);return c.json({outcome:'filtered',reason:'inbound_filter',filters:matches},202)}
    const existing=await stmt(db,'SELECT digest,issue FROM events WHERE project=? AND id=?',project,event.eventId).first<any>();
    if(existing)return await duplicate(existing);
    const budget=await stmt(db,"SELECT COALESCE(SUM(count),0) total FROM outcomes WHERE project=? AND window>=? AND reason IN ('accepted','rejected','invalid','oversized','rate_limited','budget','unregistered_release_or_build','missing_release_register_required')",project,Math.floor(Date.now()/60000)*60000).first<any>();
    if(budget.total>=120){await record('rate_limited');c.header('Retry-After','60');return c.json({outcome:'dropped',reason:'minute_budget',retryAfter:60},429)}
    const prepared=await prepareRelease(db,project,event,sentryIntake);
    if(prepared.refusal){await record(prepared.refusal);return c.json({outcome:'rejected',reason:prepared.refusal,register:`/projects/${encodeURIComponent(project)}/releases`},422)}
    event=prepared.event!;
    const releaseSequence=event.release?`(SELECT seq FROM releases WHERE project=? AND name=?)`:'0';
    const releaseArgs=event.release?[project,event.release]:[];
    const count=await stmt(db,'SELECT COUNT(*) total FROM events WHERE project=?',project).first<any>();
    if(count.total>=10000){await record('budget');c.header('Retry-After','60');return c.json({outcome:'dropped',reason:'retained_event_budget',retryAfter:60},429)}
    const groupingPolicy=await readGroupingPolicy(db,project);
    event=normalize(event.sentry?{...event,grouping:undefined,sentry:{...event.sentry,grouping:groupingPolicy.revision?groupingPolicy:undefined}}:{...event,grouping:groupingPolicy.revision?groupingPolicy:undefined});
    const {algorithm,basis,fingerprint,route}=await captureGrouping(db,project,event),issue=await hash(project+':'+fingerprint);
    const diagnosis=JSON.stringify(await diagnose(db,project,event)),time=Date.now(),originGuard=scope.foreign?crypto.randomUUID():null,alertId=crypto.randomUUID(),occurrence=crypto.randomUUID();
    const jobs=[...prepared.jobs!,groupingPolicyFence(db,project,groupingPolicy.revision),
      ...(originGuard?[stmt(db,'INSERT INTO browser_origin_guards VALUES(?,?,?)',originGuard,project,scope.foreign)]:[]),
      stmt(db,"INSERT INTO issues(id,project,fingerprint,algorithm,title,state,revision,count,first_seen,last_seen) VALUES(?,?,?,?,?,'open',0,0,?,?) ON CONFLICT(id) DO NOTHING",issue,project,fingerprint,algorithm,scrub(event.type+': '+event.message),time,time),
      ...assignShortId(db,project,issue,time),
      ...(route?[
       stmt(db,'INSERT INTO grouping_routes VALUES(?,?,?,?) ON CONFLICT(project,fingerprint) DO NOTHING',project,route.fingerprint,issue,basis),
       stmt(db,'INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM grouping_routes WHERE project=? AND fingerprint=? AND issue=? AND basis=?) THEN 1 ELSE 0 END',project,route.fingerprint,issue,basis),
      ]:[]),
      startCaptureHistory(db,project,issue,time),
      stmt(db,`INSERT INTO events(id,project,issue,release,release_seq,build,environment,payload,digest,diagnostic,received,occurrence,historical) VALUES(?,?,?,?,${releaseSequence},?,?,?,?,?,${receivedAtSql},?,0)`,event.eventId,project,issue,event.release,...releaseArgs,event.build,event.environment,JSON.stringify(event),digest,diagnosis,occurrence),
      ...identity?eventIdentityStatements(db,identity,event.eventId,occurrence):[],
      stmt(db,`INSERT INTO event_suppressions SELECT e.project,e.id,e.occurrence,(SELECT json_group_array(json_object('id',p.id,'revision',p.revision,'field',p.field,'mode',p.mode,'value',p.value)) FROM suppression_policies p WHERE ${policyMatch}) FROM events e WHERE e.project=? AND e.id=? AND EXISTS(SELECT 1 FROM suppression_policies p WHERE ${policyMatch})`,...matchArgs(project,fingerprint,event.release,event.message),project,event.eventId,...matchArgs(project,fingerprint,event.release,event.message)),
      stmt(db,"INSERT INTO issue_resolutions(project,issue,mode,seen_without_release,updated,boundary_seq,observed_seq) VALUES(?,?,'current',0,?,NULL,0) ON CONFLICT(project,issue) DO NOTHING",project,issue,time),
      stmt(db,`UPDATE issue_resolutions SET observed_seq=(SELECT CASE WHEN ${newerReleaseSql('issue_resolutions.project','incoming','issue_resolutions.observed_seq')} THEN incoming.release_seq ELSE issue_resolutions.observed_seq END FROM events incoming WHERE incoming.project=issue_resolutions.project AND incoming.id=? AND incoming.occurrence=?) WHERE project=? AND issue=?`,event.eventId,occurrence,project,issue),
      ...admissionAlerts(db,{alertId,project,issue,eventId:event.eventId,occurrence,release:event.release,build:event.build,sequence:0,time,origin:c.env.ALERT_PUBLIC_ORIGIN??c.env.AUTH_ORIGIN}),
      rememberUnsuppressedCapture(db,project,issue,event.eventId,occurrence,time),
      stmt(db,`UPDATE issues AS i SET count=count+1,last_seen=?,revision=revision+1,state=CASE WHEN state='resolved' AND EXISTS(SELECT 1 FROM events incoming WHERE incoming.project=i.project AND incoming.id=? AND incoming.occurrence=? AND ${regressionSql()} AND NOT EXISTS(SELECT 1 FROM event_suppressions receipt WHERE receipt.project=incoming.project AND receipt.event=incoming.id AND receipt.occurrence=incoming.occurrence)) THEN 'open' ELSE state END WHERE id=?`,time,event.eventId,occurrence,issue),
      stmt(db,"UPDATE issue_resolutions SET seen_without_release=seen_without_release+1 WHERE project=? AND issue=? AND mode IN ('current','next','named') AND EXISTS(SELECT 1 FROM issues WHERE id=? AND state='resolved') AND ?=''",project,issue,issue,event.release),
      ...prepared.notes!.map(note=>outcomeStatement(db,project,'sentry_release_'+note)),
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
