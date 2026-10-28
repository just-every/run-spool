import { resolveMembership } from '../members/resolver';
import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { runtimeBindings, type Bindings } from '../../auth/bindings';
import { AuthError } from '../../modules/operator-auth/index.mjs';
import type { OwnerSession } from '../owner-authority';
import { auditActor, auditSubject } from './identity';
import { recordAudit, responseOutcome } from './record';
import { requestActor } from './request';
import { auditExportPage, auditHighWater, auditPage } from './read';
import { auditColumns } from './archive';
import type { AuditActor, AuditFact } from './types';

type Context = {Bindings:Bindings;Variables:{auditSession:OwnerSession;auditActor:AuditActor}};
export const auditRoutes=new Hono<Context>();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
async function fact(c:any,action: 'audit.read'|'audit.export'): Promise<Omit<AuditFact,'outcome'>> {
 return {source:'request',actor:c.get('auditActor')??await requestActor(c.req.raw,c.env),action,
  subject:await auditSubject(c.env.DB,'audit','organization')};
}
const action=(path:string)=>path.endsWith('/export')?'audit.export' as const:'audit.read' as const;
auditRoutes.onError(async(error,c)=>{
 const invalid=['invalid_audit_cursor','invalid_audit_limit','invalid_export_format','invalid_audit_query'];
 const status=error instanceof AuthError?error.status:invalid.includes(error.message)?400:503;
 await recordAudit(c.env.DB,{...await fact(c,action(c.req.path)),outcome:responseOutcome(status),status});
 return c.json({error:status===400?'Invalid audit request':status===503?'Audit unavailable':'Owner session required'},status as any,headers);
});
auditRoutes.use('*',async(c,next)=>{
 const session=await ownerSession(c.req.raw,runtimeBindings(c.env),resolveMembership);
 if(!session){
  await recordAudit(c.env.DB,{...await fact(c,action(c.req.path)),outcome:'denied',status:401});
  return c.json({error:'Owner session required'},401,headers);
 }
 c.set('auditSession',session);c.set('auditActor',await auditActor(c.env.DB,{kind:session.membership?'member':'owner',authority:session.operator.id}));
 c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
 await next();
});
auditRoutes.get('/',async c=>{
 const url=new URL(c.req.url);
 if([...url.searchParams.keys()].some(key=>!['cursor','limit'].includes(key)))throw new Error('invalid_audit_query');
 const raw=url.searchParams.get('limit');
 if(raw!==null&&!/^[1-9]\d{0,2}$/.test(raw))throw new Error('invalid_audit_limit');
 const page=await auditPage(c.env.DB,url.searchParams.get('cursor')??undefined,raw===null?50:Number(raw));
 await recordAudit(c.env.DB,{...await fact(c,'audit.read'),outcome:'succeeded',status:200});
 return c.json(page);
});
auditRoutes.get('/export',async c=>{
 const url=new URL(c.req.url),format=url.searchParams.get('format')??'json';
 if([...url.searchParams.keys()].some(key=>!['format','highWater'].includes(key)))throw new Error('invalid_audit_query');
 if(format!=='json'&&format!=='csv')throw new Error('invalid_export_format');
 const maximum=await auditHighWater(c.env.DB),raw=url.searchParams.get('highWater'),highWater=raw===null?maximum:Number(raw);
 if(raw!==null&&(!/^\d{1,16}$/.test(raw)||!Number.isSafeInteger(highWater)||highWater<0||highWater>maximum))throw new Error('invalid_audit_cursor');
 // The export never contains its own audit entries, or subsequent appends.
 let page=await auditExportPage(c.env.DB,highWater),after=0,opened=false,finished=false;
 const base=await fact(c,'audit.export');
 await recordAudit(c.env.DB,{...base,outcome:'started',status:200});
 const encode=new TextEncoder(),session=c.get('auditSession');
 const finish=async(outcome:AuditFact['outcome'])=>{if(!finished){finished=true;await recordAudit(c.env.DB,{...base,outcome,status:200});}};
 const cell=(value:unknown)=>'"'+String(value??'').replaceAll('"','""')+'"';
 const stream=new ReadableStream<Uint8Array>({
  async pull(controller){
   try {
    const current=await ownerSession(c.req.raw,runtimeBindings(c.env),resolveMembership);
    if(!current||current.operator.id!==session.operator.id||current.operator.version!==session.operator.version){await finish('denied');controller.error(new Error('Audit export authority changed'));return;}
    if(!opened){opened=true;controller.enqueue(encode.encode(format==='csv'?auditColumns.join(',')+'\r\n':JSON.stringify({version:1,scope:'organization',highWater}).slice(0,-1)+',"rows":['));return;}
    if(page.length){
     const chunk=format==='csv'?page.map(row=>auditColumns.map(column=>cell(row[column])).join(',')).join('\r\n')+'\r\n':(after?',':'')+page.map(row=>JSON.stringify(row)).join(',');
     after=page.at(-1)!.sequence;
     controller.enqueue(encode.encode(chunk));page=await auditExportPage(c.env.DB,highWater,after);return;
    }
    await finish('succeeded');
    if(format==='json')controller.enqueue(encode.encode(']}'));
    controller.close();
   }catch(error){await finish('failed');controller.error(error);}
  },
  async cancel(){await finish('uncertain');},
 });
 return new Response(stream,{headers:{...headers,'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="spool-audit.${format}"`}});
});
auditRoutes.notFound(async c=>{
 await recordAudit(c.env.DB,{...await fact(c,action(c.req.path)),outcome:'invalid',status:404});
 return c.json({error:'Audit route not found'},404,headers);
});
