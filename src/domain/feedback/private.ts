import { SentryWireError } from '../sentry/wire';
import { scrub } from '../privacy';

export const privateLimits = { screenshotBytes: 131072, replyCharacters: 2000, replies: 20 };
export type Reply = { id:string; message:string; created:number; state:'queued'|'sent'|'failed'|'never_sent'; code:string };
export type PrivateFeedback = { version:1; consent:true; contact:string|null; screenshot:string|null; review:'pending'|'reviewed'; replies:Reply[] };
const invalid = ():never => { throw new SentryWireError('invalid_feedback_private_data',422); };
export function contactEmail(value:unknown):string {
 if(typeof value!=='string'||value.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value))return invalid();
 return value;
}
const crc32=(bytes:Uint8Array)=>{
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^0xffffffff)>>>0;
};
/** Raster PNG only. Retain rendering chunks, discarding EXIF, text, filenames,
 * URLs and every ancillary metadata chunk. Never render reporter-supplied HTML/SVG. */
export function screenshotPng(value:unknown):string {
 if(typeof value!=='string'||value.length>Math.ceil(privateLimits.screenshotBytes/3)*4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))return invalid();
 let bytes:Uint8Array;
 try{bytes=Uint8Array.from(atob(value),char=>char.charCodeAt(0))}catch{return invalid()}
 if(bytes.length>privateLimits.screenshotBytes||bytes.length<45||![137,80,78,71,13,10,26,10].every((byte,i)=>bytes[i]===byte))return invalid();
 const view=new DataView(bytes.buffer),kept=[bytes.slice(0,8)];
 let offset=8,header=false,data=false,ended=false,palette=false,depth=0,color=0;
 while(offset+12<=bytes.length){
  const length=view.getUint32(offset),end=offset+12+length;
  if(end>bytes.length||ended)return invalid();
  const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
  if(!/^[A-Za-z]{4}$/.test(type)||crc32(bytes.slice(offset+4,end-4))!==view.getUint32(end-4))return invalid();
  if(!header&&type!=='IHDR')return invalid();
  if(type==='IHDR'){
   if(header||length!==13)return invalid();
   const width=view.getUint32(offset+8),height=view.getUint32(offset+12);depth=bytes[offset+16];color=bytes[offset+17];
   if(!width||!height||width>4096||height>4096||!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]} as Record<number,number[]>)[color]?.includes(depth)||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)return invalid();
   header=true;
  }else if(type==='IDAT'){if(color===3&&!palette)return invalid();data=true}
  else if(type==='IEND'){if(length!==0||!data||end!==bytes.length)return invalid();ended=true}
  else if(type==='PLTE'){if(palette||data||!length||length%3||length>768)return invalid();palette=true}
  else if(type==='tRNS'){if(data||length>256)return invalid()}
  else if(type[0]===type[0].toUpperCase())return invalid();
  if(['IHDR','PLTE','IDAT','IEND','tRNS'].includes(type))kept.push(bytes.slice(offset,end));
  offset=end;
 }
 if(!ended||offset!==bytes.length)return invalid();
 return btoa(kept.map(chunk=>Array.from(chunk,byte=>String.fromCharCode(byte)).join('')).join(''));
}
/** Standard Sentry contact/attachments remain excluded without this explicit
 * consent extension. An absent extension preserves the description-only path. */
export function privateInput(value:unknown):PrivateFeedback|null {
 if(value===undefined)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
 const input=value as Record<string,unknown>;
 if(input.consent!==true||Object.keys(input).some(key=>!['consent','contactEmail','screenshotPng'].includes(key)))return invalid();
 return {version:1,consent:true,contact:input.contactEmail==null?null:contactEmail(input.contactEmail),screenshot:input.screenshotPng==null?null:screenshotPng(input.screenshotPng),review:'pending',replies:[]};
}
export function privateData(value:string|null):PrivateFeedback|null {
 return value===null?null:JSON.parse(value);
}
export function privateSummary(value:PrivateFeedback|null){
 return value?{consent:true,contact:value.contact,screenshot:!!value.screenshot,review:value.review,
  replies:value.replies.map(reply=>({...reply,message:scrub(reply.message),...(reply.state==='queued'&&Date.now()-reply.created>60000?{state:'failed',code:'delivery_unconfirmed'}:{})}))}:null;
}
export function validatePrivate(value:string|null){
 if(value===null)return;
 const data=privateData(value)!;
 if(!data||Object.keys(data).sort().join()!=='consent,contact,replies,review,screenshot,version'||data.version!==1||data.consent!==true||!['pending','reviewed'].includes(data.review))return invalid();
 if(data.contact!==null)contactEmail(data.contact);
 if(data.screenshot!==null&&screenshotPng(data.screenshot)!==data.screenshot)return invalid();
 if(!Array.isArray(data.replies)||data.replies.length>privateLimits.replies)return invalid();
 const ids=new Set<string>();
 for(const reply of data.replies){
  if(Object.keys(reply).sort().join()!=='code,created,id,message,state'||! /^[a-f0-9-]{36}$/.test(reply.id)||ids.has(reply.id)||typeof reply.message!=='string'||!reply.message.trim()||reply.message.length>privateLimits.replyCharacters||scrub(reply.message)!==reply.message||!Number.isSafeInteger(reply.created)||reply.created<0||!['queued','sent','failed','never_sent'].includes(reply.state)||!['queued','provider_accepted','mail_off','mail_suppressed','mail_unconfigured','provider_failed','delivery_unconfirmed'].includes(reply.code))return invalid();
  ids.add(reply.id);
 }
}
