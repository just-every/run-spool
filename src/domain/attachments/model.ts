import { hash, canonical, scrub } from '../privacy';
import { validateOccurrence } from '../occurrences';
export const attachmentLimits = {itemBytes:262144,projectBytes:16777216,projectRecords:1000};
export const attachmentTables = {attachment_policies:['project','enabled','revision','updated'],event_attachments:['project','id','event','occurrence','name','type','content_type','bytes','payload','digest','created']};
export const attachmentOutcomes=['attachment_stored','attachment_duplicate','attachment_disabled','attachment_invalid','attachment_oversized','attachment_capacity','attachment_event_unavailable','attachment_withdrawn'];
export const attachmentDefaults=(data:any)=>({attachment_policies:[],event_attachments:[],...data});
export const attachmentExportRow=(table:string,row:any)=>table==='attachment_policies'?{...row,enabled:0}:row;
export function attachmentName(value:unknown){
 if(typeof value!=='string')throw new Error('attachment_invalid');
 const name=scrub(value.split(/[\\/]/).at(-1)??'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,150);
 if(!name.trim())throw new Error('attachment_invalid');return name;
}
export const attachmentType=(value:unknown)=>typeof value==='string'&&/^[a-z][a-z0-9_.]{0,99}$/.test(value)?value:'event.attachment';
export const attachmentContentType=(value:unknown)=>typeof value==='string'&&['image/png','image/jpeg','application/json','text/plain','application/octet-stream'].includes(value.toLowerCase())?value.toLowerCase():'application/octet-stream';
export async function attachmentDigest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
export const attachmentIdentity=(row:any)=>hash(canonical([row.event,row.occurrence,row.name,row.type,row.digest]));
export const encodeAttachment=(bytes:Uint8Array)=>{let text='';for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(text)};
export function decodeAttachment(text:string){const binary=atob(text);if(btoa(binary)!==text)throw new Error('attachment_invalid');return Uint8Array.from(binary,char=>char.charCodeAt(0))}
export function attachmentProjection(row:any){const {payload,...metadata}=row;return metadata}
export async function validateAttachmentArchive(data:any){
 const ids=new Set<string>(),sizes=new Map<string,{bytes:number;records:number}>(),parents=new Set(data.events.map((row:any)=>JSON.stringify([row.project,row.id,row.occurrence])));
 for(const row of data.attachment_policies)if(![0,1].includes(row.enabled)||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.updated)||row.updated<0)throw new Error('Archive attachment policy');
 for(const row of data.event_attachments){
  validateOccurrence(row.occurrence);const key=JSON.stringify([row.project,row.id]),size=sizes.get(row.project)??{bytes:0,records:0};
  if(ids.has(key)||!parents.has(JSON.stringify([row.project,row.event,row.occurrence]))||attachmentName(row.name)!==row.name||attachmentType(row.type)!==row.type||attachmentContentType(row.content_type)!==row.content_type||!Number.isSafeInteger(row.bytes)||row.bytes<1||row.bytes>attachmentLimits.itemBytes||!Number.isSafeInteger(row.created)||row.created<0)throw new Error('Archive attachment identity');
  const bytes=decodeAttachment(row.payload);if(bytes.length!==row.bytes||await attachmentDigest(bytes)!==row.digest||await attachmentIdentity(row)!==row.id)throw new Error('Archive attachment integrity');
  ids.add(key);size.bytes+=row.bytes;size.records++;if(size.bytes>attachmentLimits.projectBytes||size.records>attachmentLimits.projectRecords)throw new Error('Archive attachment capacity');sizes.set(row.project,size);
 }
}
