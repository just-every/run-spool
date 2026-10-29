import { Hono } from 'hono';
import { ownerSession, ownerWrite } from '../../auth/session.server';
import { resolveMembership } from '../members/resolver';
import { agentProject } from '../agent-access';
import { ownerBatch } from '../owner-authority';
import { jsonBody } from '../owner-router';
import { auditCommit } from '../audit/context';
import { hash } from '../privacy';
import { recordParameters, recordCursor, nextRecordCursor, recordFilter } from '../investigation/record-page';
import { attachmentLimits, attachmentProjection, decodeAttachment } from './model';
import { erasureStatements } from '../../modules/portability/journal.mjs';
import { portability } from '../portability';

const routes=new Hono<any>();
const authorize=async(c:any,next:any)=>{
 c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
 const project=c.req.param('project'),grant=await agentProject(c.req.raw,c.env.DB),read=['GET','HEAD'].includes(c.req.method);
 const session=grant?null:await ownerSession(c.req.raw,c.env,resolveMembership);
 if(!read){
  if(!session||session.membership||grant)return c.json({error:'Owner session required'},401);
  if(!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin required'},403);
  c.set('attachmentSession',session);
 }else if(grant!==project&&!session||grant&&grant!==project)return c.json({error:'Sign in required'},401);
 if(!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first())return c.json({error:'Project not found'},404);
 await next();
};
for(const path of ['/:project/attachment-policy','/:project/attachments','/:project/attachments/:attachment','/:project/attachments/:attachment/content'])routes.use(path,authorize);
routes.get('/:project/attachment-policy',async c=>{
 const row=await c.env.DB.prepare('SELECT enabled,revision,updated FROM attachment_policies WHERE project=?').bind(c.req.param('project')).first();
 return c.json({version:1,...row??{enabled:0,revision:0,updated:null},bounds:attachmentLimits,coverage:'Explicit owner approval is required before private original bytes are retained. Binary content is not scrubbed or native-device qualified. Owner self-erasure refuses while attribution of retained binary content is unavailable. Disable capture before sending sensitive content.'});
});
routes.put('/:project/attachment-policy',async c=>{
 const input=await jsonBody(c.req.raw,2048),project=c.req.param('project'),db:D1Database=c.env.DB;
 if(Object.keys(input).some(key=>!['enabled','revision','confirm'].includes(key))||typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.revision)||input.revision<0||input.enabled&&input.confirm!=='retain private original bytes')return c.json({error:'Confirm private original-byte retention explicitly and use the current revision'},400);
 const current=await db.prepare('SELECT revision FROM attachment_policies WHERE project=?').bind(project).first<{revision:number}>();
 if((current?.revision??0)!==input.revision)return c.json({error:'Attachment policy changed; refresh'},409);
 await ownerBatch(db,c.get('attachmentSession'),[
  db.prepare("INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE((SELECT revision FROM attachment_policies WHERE project=?),0)=? THEN 1 ELSE 0 END").bind(project,input.revision),
  db.prepare('INSERT INTO attachment_policies(project,enabled,revision,updated) VALUES(?,?,?,?) ON CONFLICT(project) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,updated=excluded.updated').bind(project,input.enabled?1:0,input.revision+1,Date.now()),
  auditCommit(db),
 ]);
 return c.json({version:1,enabled:input.enabled,revision:input.revision+1});
});
routes.get('/:project/attachments',async c=>{
 const project=c.req.param('project'),db:D1Database=c.env.DB,url=new URL(c.req.url);
 const {order,direction,comparison}=recordParameters(url,['order','cursor','event']);
 const event=recordFilter(c.req.query('event')??null,100),signature=await hash(JSON.stringify(['attachments-v1',project,event,order])),cursor=recordCursor(c.req.query('cursor'),signature);
 const where='project=?'+(event===null?'':' AND event=?'),args=[project,...event===null?[]:[event]];
 const [page,total]=await Promise.all([
  db.prepare(`SELECT project,id,event,occurrence,name,type,content_type,bytes,digest,created FROM event_attachments WHERE ${where}${cursor?` AND (created,id)${comparison}(?,?)`:''} ORDER BY created ${direction},id COLLATE BINARY ${direction} LIMIT 26`).bind(...args,...cursor?[cursor.time,cursor.id]:[]).all<any>(),
  db.prepare(`SELECT COUNT(*) total FROM event_attachments WHERE ${where}`).bind(...args).first<{total:number}>(),
 ]);
 const rows=page.results.slice(0,25).map(attachmentProjection),last=rows[24];
 return c.json({version:1,project,rows,total:total!.total,next:page.results.length>25?nextRecordCursor(signature,last.created,last.id):null,bounds:{pageSize:25,...attachmentLimits},order,filters:{event},coverage:'Owner-approved private attachment metadata, bound to an exact retained event occurrence. Original binary bytes are not scrubbed. Cursors observe current retained data.'});
});
routes.get('/:project/attachments/:attachment/content',async c=>{
 const project=c.req.param('project'),url=new URL(c.req.url);recordParameters(url,['download']);
 if(url.searchParams.has('download')&&c.req.query('download')!=='1')throw new Error('Invalid attachment download');
 const row=await c.env.DB.prepare('SELECT * FROM event_attachments WHERE project=? AND id=?').bind(project,c.req.param('attachment')).first();
 if(!row)return c.json({error:'Attachment not found'},404);
 const bytes=decodeAttachment(row.payload),png=bytes.length>8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value),jpeg=bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const image=row.content_type==='image/png'&&png?'image/png':row.content_type==='image/jpeg'&&jpeg?'image/jpeg':null,download=c.req.query('download')==='1'||!image;
 const filename=encodeURIComponent(row.name).replace(/[!'()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
 return new Response(bytes as Uint8Array<ArrayBuffer>,{headers:{'Content-Type':image??'application/octet-stream','Content-Disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${filename}`,'Content-Length':String(bytes.length),'Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
});
routes.delete('/:project/attachments/:attachment',async c=>{
 const project=c.req.param('project'),id=c.req.param('attachment'),db:D1Database=c.env.DB;
 if(!await db.prepare('SELECT 1 FROM event_attachments WHERE project=? AND id=?').bind(project,id).first())return c.json({error:'Attachment not found'},404);
 const transfer=await portability(db);
 await ownerBatch(db,c.get('attachmentSession'),[
  ...await transfer.invalidateTransfersStatements(),...await erasureStatements(db,'event_attachments',{project,id}),
  db.prepare('DELETE FROM event_attachments WHERE project=? AND id=?').bind(project,id),auditCommit(db),
 ]);
 return c.json({withdrawn:true,externalCopies:'Downloaded copies require separate removal. An empty installation requires the later erasure journal to reject older archives.'});
});
export default routes;
