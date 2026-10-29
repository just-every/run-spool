import { attachmentLimits, attachmentName, attachmentType, attachmentContentType, attachmentDigest, attachmentIdentity, encodeAttachment } from './model';
import { filterCategory } from '../filters/categories';
import { ingestBatch, recordIngest, outcomeStatement, type IngestScope } from '../admission';
import { state, guard } from '../../modules/portability/storage.mjs';
import { tombstone } from '../../modules/portability/journal.mjs';
import type { SentryItem } from '../sentry/wire';

/** Original bytes stay private and are admitted only after explicit owner approval.
 * This bounded store does not claim binary-content scrubbing or native qualification. */
export async function admitAttachments(c:any,scope:IngestScope,items:SentryItem[],event:unknown){
 const db:D1Database=c.env.DB,project=scope.project,counts:Record<string,number>={};
 const count=async(reason:string)=>{counts[reason]=(counts[reason]??0)+1;await recordIngest(c,scope,reason)};
 for(const item of items){
  if(!(await db.prepare('SELECT 1 FROM attachment_policies WHERE project=? AND enabled=1').bind(project).first())){await count('attachment_disabled');continue;}
  if(typeof event!=='string'||!/^[a-f0-9]{32}$/.test(event)){await count('attachment_event_unavailable');continue;}
  const parent=await db.prepare('SELECT occurrence,release,environment FROM events WHERE project=? AND id=?').bind(project,event).first<any>();
  if(!parent){await count('attachment_event_unavailable');continue;}
  if((await filterCategory(c,scope,parent)).length)continue;
  if(item.bytes.length>attachmentLimits.itemBytes){await count('attachment_oversized');continue;}
  let row:any;
  try{
   if(!item.bytes.length)throw new Error();
   row={project,event,occurrence:parent.occurrence,name:attachmentName(item.header.filename),type:attachmentType(item.header.attachment_type),content_type:attachmentContentType(item.header.content_type),bytes:item.bytes.length,payload:encodeAttachment(item.bytes),digest:await attachmentDigest(item.bytes),created:Date.now()};
   row.id=await attachmentIdentity(row);
  }catch{await count('attachment_invalid');continue;}
  const previous=await db.prepare('SELECT 1 FROM event_attachments WHERE project=? AND id=?').bind(project,row.id).first();
  if(previous){await count('attachment_duplicate');continue;}
  const before=await state(db),key=await tombstone(before.source_identity,'event_attachments',{project,id:row.id});
  if(await db.prepare('SELECT 1 FROM rer_portability_journal WHERE source=? AND tombstone=?').bind(before.source_identity,key).first()){await count('attachment_withdrawn');continue;}
  try{
   await ingestBatch(c,scope,[
    guard(db,"EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND source_identity=? AND epoch=?) AND EXISTS(SELECT 1 FROM events WHERE project=? AND id=? AND occurrence=?) AND EXISTS(SELECT 1 FROM attachment_policies WHERE project=? AND enabled=1) AND NOT EXISTS(SELECT 1 FROM rer_portability_journal WHERE source=? AND tombstone=?)",before.source_identity,before.epoch,project,event,parent.occurrence,project,before.source_identity,key),
    db.prepare('INSERT INTO event_attachments(project,id,event,occurrence,name,type,content_type,bytes,payload,digest,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(project,row.id,event,row.occurrence,row.name,row.type,row.content_type,row.bytes,row.payload,row.digest,row.created),
    outcomeStatement(db,project,'attachment_stored'),
   ]);
   counts.attachment_stored=(counts.attachment_stored??0)+1;
  }catch(error){
   if(String(error).includes('attachment_capacity'))await count('attachment_capacity');
   else if(await db.prepare('SELECT 1 FROM event_attachments WHERE project=? AND id=?').bind(project,row.id).first())await count('attachment_duplicate');
   else throw error;
  }
 }
 return counts;
}
