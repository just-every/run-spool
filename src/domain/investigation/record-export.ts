import { scrub } from '../privacy';
import { eventQuery } from './query';
import { ensureReleaseOrderKeys } from '../releases/order';
import { recordParameters, recordFilter } from './record-page';
import { exportAuthority } from './export-authority';
import { auditedExport } from '../audit/export';

/** A metadata export, distinct from a private archive or a raw event payload. */
export async function recordExport(c: any) {
 const project = c.req.param('project'), db: D1Database = c.env.DB, url = new URL(c.req.url);
 const {order,direction,comparison} = recordParameters(url,['q','issue','order','format']);
 const q = c.req.query('q') ?? '', issue = recordFilter(c.req.query('issue') ?? null,100), format = c.req.query('format') ?? 'json';
 if (!['json','csv'].includes(format)) throw new Error('Export format must be json or csv');
 const authority = await exportAuthority(c,project), query = eventQuery(q,authority.agent);
 if (query.usesLatest) await ensureReleaseOrderKeys(db,project);
 if (issue !== null && !await db.prepare('SELECT 1 FROM issues WHERE project=? AND id=?').bind(project,issue).first()) return c.json({error:'Issue not found'},404);
 const where = `e.project=? AND (${query.sql})`+(issue===null?'':' AND e.issue=?'), args=[project,...query.args,...issue===null?[]:[issue]];
 const total=(await db.prepare(`SELECT COUNT(*) total FROM events e WHERE ${where}`).bind(...args).first<{total:number}>())!.total;
 const keys=['id','occurrence','issue','received','release','build','environment','type','message'];
 const encoder=new TextEncoder();let opened=false,count=0,after:{received:number;id:string}|undefined;
 const cell=(value:unknown)=>{const text=String(value??'');return '"'+(/^[\s\p{Cc}]*[=+\-@]/u.test(text)?"'"+text:text).replaceAll('"','""')+'"'};
 const source=new ReadableStream<Uint8Array>({async pull(controller){
  try {
   await authority.check();
   if(!opened){opened=true;controller.enqueue(encoder.encode(format==='csv'?keys.join(','):JSON.stringify({version:1,project,query:{q,issue},total,order,bounds:{batchSize:100,limit:null,complete:true},coverage:'All matching retained occurrence metadata. Source, local variables, user identity and attachments are excluded. Batches observe current retained data; use a settled window for reconciliation.'}).slice(0,-1)+',"rows":['));return;}
   const page=await db.prepare(`SELECT e.id,e.occurrence,e.issue,e.received,e.release,e.build,e.environment,json_extract(e.payload,'$.type') type,json_extract(e.payload,'$.message') message FROM events e WHERE ${where}${after?` AND (e.received,e.id)${comparison}(?,?)`:''} ORDER BY e.received ${direction},e.id COLLATE BINARY ${direction} LIMIT 100`).bind(...args,...after?[after.received,after.id]:[]).all<any>();
   if(!page.results.length){if(format==='json')controller.enqueue(encoder.encode('],"exported":'+count+'}'));controller.close();return;}
   const rows=page.results.map(row=>({...row,type:scrub(row.type),message:scrub(row.message)}));
   await authority.check();
   controller.enqueue(encoder.encode(format==='csv'?'\r\n'+rows.map(row=>keys.map(key=>cell(row[key])).join(',')).join('\r\n'):(count?',':'')+rows.map(row=>JSON.stringify(row)).join(',')));
   count+=rows.length;after=page.results.at(-1);
  }catch(error){controller.error(error);}
 }});
 return new Response(await auditedExport(db,source),{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="spool-occurrences.${format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
