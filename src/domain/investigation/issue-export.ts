import { exportAuthority } from './export-authority';
import { commitResolutionSql, commitSharing } from '../commits/sharing';
import { auditedExport } from '../audit/export';

const inert = (value: unknown) => {
 const text = String(value ?? '');
 return /^[\s\p{Cc}]*[=+\-@]/u.test(text) ? "'" + text : text;
};

/** The query returns one bounded page; response backpressure drives the next.
 * Authority and commit sharing are checked before each chunk leaves storage. */
export async function streamIssueExport(c: any, input: {
 project: string; query: unknown; total: number;
 page: (after?: any) => Promise<{rows: any[]; position: any}>;
}) {
 const db: D1Database = c.env.DB, {project} = input;
 const format = c.req.query('format') ?? 'json';
 if (!['json','csv'].includes(format)) throw new Error('Export format must be json or csv');
 const authority = await exportAuthority(c,project);
 const share = (await commitSharing(db,project)).share;
 const keys = ['short_id','id','title','state','priority','count','first_seen','last_seen','last_release','resolution_commit','resolution_citation','resolution_release',...share ? ['resolution_author','resolution_message'] : []];
 const encoder = new TextEncoder();let opened = false, position: any, count = 0;
 const source = new ReadableStream<Uint8Array>({
  async pull(controller) {
   try {
    await authority.check();
    if ((await commitSharing(db,project)).share !== share) throw new Error('Export sharing changed; restart the export');
    if (!opened) {
     opened = true;
     controller.enqueue(encoder.encode(format === 'csv' ? keys.join(',') : JSON.stringify({version:1,project,query:input.query,total:input.total,bounds:{limit:null,batchSize:100,complete:true},coverage:'All matching retained issue aggregates, streamed in batches of at most 100. Counts include all retained occurrences of matched issues. Intake and triage during an export may change the corpus; use a settled window for reconciliation.'}).slice(0,-1)+',"rows":['));
     return;
    }
    const page = await input.page(position);
    if (!page.rows.length) {
     if (format === 'json') controller.enqueue(encoder.encode('],"exported":'+count+'}'));
     controller.close();return;
    }
    const resolutions = new Map<string,any>((await db.prepare(`SELECT i.id,${commitResolutionSql('i')} resolution FROM issues i WHERE i.project=? AND i.id IN (SELECT value FROM json_each(?))`).bind(project,JSON.stringify(page.rows.map(row=>row.id))).all<any>()).results.map(row=>[row.id,row.resolution ? JSON.parse(row.resolution) : null]));
    for (const row of page.rows) {
     const resolution = resolutions.get(row.id);
     row.resolution_commit=resolution?.commit??null;row.resolution_citation=resolution?.citation??null;row.resolution_release=resolution?.release??null;
     if(share){row.resolution_author=resolution?.author?[resolution.author.name,resolution.author.email&&`<${resolution.author.email}>`].filter(Boolean).join(' '):null;row.resolution_message=resolution?.message??null;}
    }
    const cell=(value:unknown)=>'"'+inert(value).replaceAll('"','""')+'"';
    const chunk = format === 'csv' ? '\r\n'+page.rows.map(row=>keys.map(key=>cell(row[key])).join(',')).join('\r\n') : (count?',':'')+page.rows.map(row=>JSON.stringify(row)).join(',');
    await authority.check();
    if ((await commitSharing(db,project)).share !== share) throw new Error('Export sharing changed; restart the export');
    count+=page.rows.length;position=page.position;
    controller.enqueue(encoder.encode(chunk));
   } catch(error) {controller.error(error);}
  },
 });
 return new Response(await auditedExport(db,source),{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="spool-issues.${format}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
