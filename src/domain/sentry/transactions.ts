import { ingestBatch,outcomeStatement,stmt,type IngestScope } from '../admission';
import { spendKeyEvent } from '../key-rate-limits/model';
import { filterCategory } from '../filters/categories';
import { prepareScrubbing } from '../scrubbing/model';
import { canonical,hash,scrub } from '../privacy';
import { sentryRelease } from '../releases/identity';
import { objectJson,type SentryItem } from './wire';
import { receivedAtSql } from '../alerts/admission';
export { transactionOutcomes } from './transaction-outcomes';
const timestamp=(v:unknown)=>{const n=typeof v==='number'?v*1000:typeof v==='string'?Date.parse(v):NaN;return Number.isFinite(n)&&n>=0&&n<=Date.now()+300000?n:null};
const text=(v:unknown,max:number)=>typeof v==='string'&&v?scrub(v.replace(/[\x00-\x1f\x7f]/g,' ')).slice(0,max):null;
function transaction(v:any,envelopeId?:unknown){
 const id=typeof v.event_id==='string'?v.event_id.replaceAll('-','').toLowerCase():typeof envelopeId==='string'?envelopeId.replaceAll('-','').toLowerCase():'';
 const start=timestamp(v.start_timestamp),end=timestamp(v.timestamp),name=text(v.transaction,200),environment=v.environment??'production';
 if(v.type!==undefined&&v.type!=='transaction'||!/^[a-f0-9]{32}$/.test(id)||start===null||end===null||end<start||end-start>86400000||!name||typeof environment!=='string'||!environment||environment.length>100||scrub(environment)!==environment||/[\x00-\x1f\x7f]/.test(environment))return null;
 if(envelopeId!==undefined&&String(envelopeId).replaceAll('-','').toLowerCase()!==id)return null;
 return {id,name,environment,release:sentryRelease(v.release).name,op:text(v.contexts?.trace?.op,100),start:Math.floor(start),duration:Math.round((end-start)*1000)/1000};
}
export async function admitTransactions(c:any,scope:IngestScope,items:SentryItem[],envelopeId?:unknown){
 const db=c.env.DB as D1Database,p=scope.project,counts:Record<string,number>={};
 const record=async(reason:string,jobs:D1PreparedStatement[]=[])=>{await ingestBatch(c,scope,[...jobs,outcomeStatement(db,p,reason)]);counts[reason]=(counts[reason]??0)+1};
 for(const item of items){
  let raw;try{if(item.bytes.byteLength>262144)throw 0;raw=objectJson(item.bytes)}catch{await record('transaction_invalid');continue}
  const privacy=await prepareScrubbing(db,p,raw),row=transaction(privacy.document,envelopeId);
  if(!row||row.start<Date.now()-30*86400000){await record('transaction_invalid');continue}
  if((await filterCategory(c,scope,row)).length){counts.filtered=(counts.filtered??0)+1;continue}
  const digest=await hash(canonical(raw));
  const duplicate=async()=>{const prior=await stmt(db,'SELECT digest FROM sentry_transactions WHERE project=? AND id=?',p,row.id).first<{digest:string}>();return prior?prior.digest===digest?'transaction_duplicate':'transaction_conflict':null};
  const prior=await duplicate();if(prior){await record(prior);continue}
  try{
   await record('transaction_stored',[spendKeyEvent(db,p,scope.keyHash),...privacy.jobs,
    stmt(db,'DELETE FROM sentry_transactions WHERE project=? AND received<?',p,Date.now()-30*86400000),
    stmt(db,`INSERT INTO sentry_transactions VALUES(?,?,?,?,?,?,?,?,${receivedAtSql},?)`,p,row.id,row.environment,row.release,row.name,row.op,row.duration,row.start,digest)]);
  }catch(error){
   const raced=await duplicate();if(raced){await record(raced);continue}
   const reason=['transaction_capacity','transaction_rate_limited','key_rate_limited'].find(reason=>String(error).includes(reason));if(!reason)throw error;
   await record(reason);
  }
 }
 return counts;
}
