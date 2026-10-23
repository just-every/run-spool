import { ingestBatch, outcomeStatement, stmt, type IngestScope } from '../admission';
import { filterCategory } from '../filters/categories';
import { SentryWireError,type SentryItem } from '../sentry/wire';
import type {Envelope} from '../privacy';
import {readReleasePolicy,autoReleaseAllowed} from '../releases/policy';
import { absentDist } from '../releases/build';
import { prepareRelease } from '../releases/admission';
import { identityHash,prepareIdentityKey } from '../identities/key';
import { parseSessions } from './item';
export async function admitSessions(c:any,scope:IngestScope,items:SentryItem[],sdk?:any){
 const db=c.env.DB as D1Database,p=scope.project,counts:Record<string,number>={};
 const record=async(reason:string,jobs:D1PreparedStatement[]=[])=>{await ingestBatch(c,scope,[...jobs,outcomeStatement(db,p,reason)]);counts[reason]=(counts[reason]??0)+1};
 for(const item of items){
  if(item.bytes.byteLength>102400){await record('session_item_too_large');continue}
  let rows;try{rows=parseSessions(item)}catch(error){if(!(error instanceof SentryWireError))throw error;await record(error.reason==='session_missing_release'?'session_missing_release':'session_invalid');continue}
  const {release,environment}=rows[0];if((await filterCategory(c,scope,{release,environment})).length){await record('session_filtered');continue}
  const used=await stmt(db,"SELECT COALESCE(SUM(count),0) n FROM outcomes WHERE project=? AND window>=? AND reason IN ('session_stored','session_invalid','session_missing_release','session_item_too_large','session_filtered','session_capacity','session_release_refused')",p,Math.floor(Date.now()/60000)*60000).first<{n:number}>();
  if(used!.n>=1200){await record('session_rate_limited');continue}
  const releasePolicy=await readReleasePolicy(db,p);
  if(!autoReleaseAllowed(release,releasePolicy.policy)&&!await stmt(db,'SELECT 1 FROM releases WHERE project=? AND name=?',p,release).first()){await record('session_release_refused');continue}
  const prepared=await prepareRelease(db,p,{version:1,eventId:'session',release,environment:environment||'unknown',build:absentDist,type:'Session',message:'',frames:[],breadcrumbs:[],sentry:{version:1,exceptions:[],truncation:[],tags:{},contexts:{},...sdk?{sdk}:{}}} as Envelope,true);
  if(prepared.refusal||!prepared.event?.release){await record('session_release_refused');continue}
  const cutoff=Date.now()-90*86400000;if(rows.some(r=>r.started<cutoff)){await record('session_invalid');continue}
  const jobs=[...prepared.jobs!,stmt(db,'DELETE FROM health_sessions WHERE project=? AND started<?',p,cutoff),stmt(db,'DELETE FROM health_aggregates WHERE project=? AND started<?',p,cutoff)];
  const identity=rows.some(r=>r.did)?await prepareIdentityKey(db,p):null;if(identity)jobs.push(...identity.jobs);
  let conflict=false;
  for(const row of rows){
   if(row.sid){
    const prior=await stmt(db,'SELECT release,environment,started FROM health_sessions WHERE project=? AND sid=?',p,row.sid).first<any>();
    if(prior&&(prior.release!==release||prior.environment!==environment||prior.started!==row.started)){conflict=true;break}
    jobs.push(stmt(db,`INSERT INTO health_sessions VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project,sid) DO UPDATE SET
     updated=MAX(updated,excluded.updated),errors=MAX(errors,excluded.errors),user_hash=COALESCE(user_hash,excluded.user_hash),
     status=CASE WHEN status='crashed' OR excluded.status='crashed' THEN 'crashed' WHEN status='abnormal' OR excluded.status='abnormal' THEN 'abnormal' WHEN status='unhandled' OR excluded.status='unhandled' THEN 'unhandled' WHEN excluded.updated>=updated THEN excluded.status ELSE status END`,p,row.sid,release,environment,row.started,row.updated,row.status,row.errors,row.did?await identityHash(identity!.key,row.did):null));
   }else jobs.push(stmt(db,'INSERT INTO health_aggregates VALUES(?,?,?,?,?,?) ON CONFLICT(project,release,environment,started,status) DO UPDATE SET quantity=quantity+excluded.quantity',p,release,environment,row.started,row.status,row.quantity));
  }
  if(conflict){await record('session_invalid');continue}
  try{await record('session_stored',jobs)}catch(error){if(!String((error as Error).message).includes('session_capacity'))throw error;await record('session_capacity')}
 }
 return counts;
}
