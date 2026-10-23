import { objectJson, SentryWireError, type SentryItem } from '../sentry/wire';
import { sentryRelease } from '../releases/identity';
import { scrub } from '../privacy';
export const sessionOutcomes=['session_stored','session_invalid','session_missing_release','session_item_too_large','session_filtered','session_rate_limited','session_capacity','session_release_refused'];
export type SessionRow={sid?:string;release:string;environment:string;started:number;updated:number;status:string;errors:number;did?:string;quantity:number};
const integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=1000000;
export function sessionTime(value:unknown){const n=typeof value==='number'?value*1000:typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(n)||n<0||n>Date.now()+300000)throw new SentryWireError('session_invalid',422);return Math.floor(n)}
export function parseSessions(item:SentryItem):SessionRow[]{
 const invalid=()=>new SentryWireError('session_invalid',422),v=objectJson(item.bytes),attrs=v.attrs;
 if(!attrs||typeof attrs!=='object'||Array.isArray(attrs))throw invalid();
 if(attrs.release===undefined||attrs.release===null||attrs.release==='')throw new SentryWireError('session_missing_release',422);
 const release=sentryRelease(attrs.release).name;if(!release)throw invalid();
 const environment=attrs.environment??'';if(typeof environment!=='string'||environment.length>100||scrub(environment)!==environment||/[\x00-\x1f\x7f]/.test(environment))throw invalid();
 if(item.header.type==='sessions'){
  if(!Array.isArray(v.aggregates)||!v.aggregates.length||v.aggregates.length>100)throw invalid();
  const rows:SessionRow[]=[];
  for(const a of v.aggregates){if(!a||typeof a!=='object')throw invalid();const started=sessionTime(a.started);let total=0;
   for(const status of ['exited','errored','crashed','abnormal','unhandled']){const quantity=a[status]??0;if(!integer(quantity))throw invalid();if(quantity){total+=quantity;rows.push({release,environment,started:Math.floor(started/60000)*60000,updated:started,status,quantity,errors:status==='errored'||status==='crashed'?1:0})}}
   if(!total||total>1000000)throw invalid();
  }return rows;
 }
 if(typeof v.sid!=='string'||! /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(v.sid)||!['ok','exited','errored','crashed','abnormal','unhandled'].includes(v.status)||!integer(v.errors??0)||v.init!==undefined&&typeof v.init!=='boolean'||v.duration!==undefined&&(typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<0))throw invalid();
 if(v.did!==undefined&&(typeof v.did!=='string'&&typeof v.did!=='number'||String(v.did).length>1000))throw invalid();
 const started=sessionTime(v.started),updated=v.timestamp===undefined?started:sessionTime(v.timestamp);if(updated<started)throw invalid();
 return [{sid:v.sid.replaceAll('-','').toLowerCase(),release,environment,started,updated,status:v.status,errors:v.errors??0,...v.did!==undefined&&String(v.did)?{did:String(v.did)}:{},quantity:1}];
}
