import {eventQuery} from '../investigation/query';
import {pendingReview,reviewQuery} from '../review/model';
import {scrub} from '../privacy';
import {fail,window,type Window} from './input';
import {issueAttentionSql} from '../issue-attention';
import {widgetCoverage} from './coverage';

export const tableExportLimit=10000;
/** Saved definitions use review_views and reviewQuery without another grammar. */
export async function savedTableQuery(db:D1Database,project:string,viewId:string){
 const view=await db.prepare('SELECT generation,query FROM review_views WHERE project=? AND id=?').bind(project,viewId).first<{generation:string;query:string}>();
 if(!view)return fail('Saved review view not found',404);
 return {query:reviewQuery(JSON.parse(view.query)),generation:view.generation,serialized:view.query};
}
export async function eventTable(db:D1Database,project:string,value:any,input:Window,exporting=false){
 const query=reviewQuery(value),bounds=window(input),parsed=eventQuery(query.q);
 const where=`e.project=? AND e.received>=? AND e.received<? AND (${parsed.sql})${query.status!=='all'?' AND i.state=?':''}${query.release!=='all'?' AND e.release=?':''}${parsed.reviewPending?` AND ${pendingReview('i')}`:''}`;
 const args=[project,bounds.from,bounds.to,...parsed.args,...query.status!=='all'?[query.status]:[],...query.release!=='all'?[query.release]:[]];
 const attention=issueAttentionSql.replace(/ attention$/,'');
 const order=query.sort==='occurrences'?'i.count DESC,':query.sort==='priority'?`CASE json_extract(${attention},'$.kind') WHEN 'regression' THEN 2 WHEN 'new_issue' THEN 1 ELSE 0 END DESC,`:'';
 const from='events e JOIN issues i ON i.project=e.project AND i.id=e.issue',limit=exporting?tableExportLimit:25;
 const results=await db.batch([
  db.prepare(`SELECT COUNT(*) total FROM ${from} WHERE ${where}`).bind(...args),
  db.prepare(`SELECT e.id,e.occurrence,e.issue,e.received,e.release,e.build,e.environment,json_extract(e.payload,'$.type') type,json_extract(e.payload,'$.message') message FROM ${from} WHERE ${where} ORDER BY ${order}e.received DESC,e.id DESC LIMIT ?`).bind(...args,limit+1),
 ]);
 const total=Number((results[0].results[0] as any).total);
 if(exporting&&total>tableExportLimit)return fail(`reporting_export_limit: ${total} matching occurrences exceed the ${tableExportLimit} row cap; narrow the saved review query or reporting window`,413);
 const rows=results[1].results.slice(0,limit).map((row:any)=>({id:row.id,occurrence:row.occurrence,issue:row.issue,received:row.received,release:scrub(row.release),build:scrub(row.build),environment:scrub(row.environment),type:row.type===null?null:scrub(row.type),message:row.message===null?null:scrub(row.message)}));
 return {rows,total,next:null,query,metadata:await widgetCoverage(db,project,bounds),bounds:{...bounds,limit,complete:total<=limit},definition:'Retained occurrence metadata matching the existing saved review query, with all event predicates on the same occurrence. Source, locals, user identity values, attachments and full payloads are excluded. Rows are bounded explicitly; narrow the query or window to see more.'};
}
