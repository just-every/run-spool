import { resolveMembership } from '../members/resolver';
import {pendingReview} from '../review/model';
import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { agentProject } from '../agent-access';
import { issueAttentionSql, clientDroppedSql, decodeIssueAttention } from '../issue-attention';
import { issueProjection } from '../agent-projection';
import { ownerIssue } from '../stored-text';
import { hash } from '../privacy';
import { eventQuery } from './query';
import { prioritySql } from '../issue-priority/model';
import { ensureReleaseOrderKeys,issueReleasesSql,releaseOrderSql } from '../releases/order';
import { ensureShortIds } from '../short-ids/assign';
import { decodeShortIds, shortIdColumnsSql } from '../short-ids/lookup';
import { commitResolutionSql, commitSharing } from '../commits/sharing';
const routes=new Hono<any>();
// Spreadsheets evaluate a cell that opens with a formula sign, even after blanks or control
// characters; a leading apostrophe keeps captured text inert while the stored value stays as sent.
const inert=(text:string)=>/^[\s\p{Cc}]*[=+\-@]/u.test(text)?"'"+text:text;
// Independently enforce the read door; mounting this router never supplies authority.
const authorize=async(c:any,next:any)=>{
 const project=c.req.param('project'),grant=await agentProject(c.req.raw,c.env.DB);
 if(grant!==project&&!await ownerSession(c.req.raw,c.env,resolveMembership))return c.json({error:'Sign in required'},401);
 if(grant&&grant!==project)return c.json({error:'Project scope required'},403);
 c.set('agent',!!grant);
 if(!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first())return c.json({error:'Project not found'},404);
 await next();
};
routes.use('/:project/issue-search',authorize);
routes.use('/:project/issue-export',authorize);
async function search(c:any,exporting=false){
 const project=c.req.param('project'),q=c.req.query('q')??'',state=c.req.query('status')??'all',release=c.req.query('release')??'all',sort=c.req.query('sort')??'priority';
 if(!['all','unresolved','open','acknowledged','resolved','suppressed'].includes(state))throw new Error('Invalid issue status');
 if(!['priority','latest','occurrences'].includes(sort))throw new Error('Invalid issue sort');
 const query=eventQuery(q,c.get('agent')),where=['i.project=?'],args:any[]=[project];
 await ensureReleaseOrderKeys(c.env.DB,project);
 await ensureShortIds(c.env.DB,project);
 if(query.reviewPending)where.push(pendingReview('i'));
 for(const priority of query.issuePriorities){where.push(`${prioritySql('i')}=?`);args.push(priority)}
 if(query.hasEventTerms||release!=='all'){where.push(`EXISTS(SELECT 1 FROM events e WHERE e.project=i.project AND e.issue=i.id AND ${query.sql}${release!=='all'?' AND e.release=?':''})`);args.push(...query.args,...release!=='all'?[release]:[])}
 // The status views count the same query without its status, so each view says what it would show.
 const viewWhere=where.join(' AND '),viewArgs=[...args];
 if(state==='unresolved')where.push("i.state IN ('open','acknowledged')");else if(state!=='all'){where.push('i.state=?');args.push(state)}
 const filtered=`SELECT i.*, ${prioritySql('i')} priority, ${pendingReview('i')} review_pending, ${shortIdColumnsSql('i')}, ${issueAttentionSql}, ${clientDroppedSql}, (SELECT release FROM events WHERE project=i.project AND issue=i.id ORDER BY received DESC,id DESC LIMIT 1) last_release,${issueReleasesSql('i')} releases FROM issues i WHERE ${where.join(' AND ')}`;
 const cte=`WITH filtered AS (${filtered}), ranked AS (SELECT *,${sort==='occurrences'?'count':sort==='priority'?"(CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)*3+CASE json_extract(attention,'$.kind') WHEN 'regression' THEN 2 WHEN 'new_issue' THEN 1 ELSE 0 END":'last_seen'} rank FROM filtered)`;
 const db=c.env.DB,statement=(sql:string,...extra:any[])=>db.prepare(cte+' '+sql).bind(...args,...extra);
 const signature=await hash(JSON.stringify([project,q,state,release,sort]));
 let cursor:any=null;
 if(c.req.query('cursor')){try{cursor=JSON.parse(atob(c.req.query('cursor')))}catch{throw new Error('Invalid search cursor')}if(cursor?.signature!==signature||!Number.isFinite(cursor.rank)||!Number.isFinite(cursor.last_seen)||typeof cursor.id!=='string')throw new Error('Search cursor belongs to another query')}
 const total=await statement('SELECT COUNT(*) total,COALESCE(SUM(review_pending),0) reviewPending FROM ranked').first() as any;
 if(exporting&&total.total>10000)return c.json({error:'query_export_limit',matched:total.total,limit:10000,action:'Narrow the query or paginate the issue-search API.'},413);
 const size=exporting?10000:25;
 const page=await statement(`SELECT * FROM ranked ${cursor&&!exporting?'WHERE (rank,last_seen,id)<(?,?,?)':''} ORDER BY rank DESC,last_seen DESC,id DESC LIMIT ?`,...cursor&&!exporting?[cursor.rank,cursor.last_seen,cursor.id]:[],size+1).all();
 const rows=page.results.slice(0,size).map((row:any)=>{const {rank,...issue}=decodeShortIds(decodeIssueAttention(row));return c.get('agent')?issueProjection(issue):ownerIssue(issue)}),last=page.results[size-1];
 if(exporting){const format=c.req.query('format')??'json';if(!['json','csv'].includes(format))throw new Error('Export format must be json or csv');
  // An export leaves the owner session: the resolving commit's SHA and release, its author and message only when shared.
  const share=(await commitSharing(db,project)).share,resolutions=new Map<string,any>((await db.prepare(`SELECT i.id,${commitResolutionSql('i')} resolution FROM issues i WHERE i.project=? AND i.id IN (SELECT value FROM json_each(?))`).bind(project,JSON.stringify(rows.map((r:any)=>r.id))).all()).results.map((r:any)=>[r.id,r.resolution?JSON.parse(r.resolution):null]));
  for(const r of rows as any[]){const resolution=resolutions.get(r.id);r.resolution_commit=resolution?.commit??null;r.resolution_citation=resolution?.citation??null;r.resolution_release=resolution?.release??null;if(share){r.resolution_author=resolution?.author?[resolution.author.name,resolution.author.email&&`<${resolution.author.email}>`].filter(Boolean).join(' '):null;r.resolution_message=resolution?.message??null}}
  const keys=['short_id','id','title','state','priority','count','first_seen','last_seen','last_release','resolution_commit','resolution_citation','resolution_release',...share?['resolution_author','resolution_message']:[]];const cell=(v:any)=>'"'+inert(String(v??'')).replaceAll('"','""')+'"';return new Response(format==='csv'?[keys.join(','),...rows.map((r:any)=>keys.map(k=>cell(r[k])).join(','))].join('\r\n'):JSON.stringify({version:1,project,query:{q,status:state,release,sort},total:total.total,rows,bounds:{limit:10000,complete:true},coverage:'Retained issue aggregates; counts include all retained occurrences of matched issues.'}),{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="spool-issues.${format}"`,'Cache-Control':'no-store'}})}
 const eventPredicate=query.sql+(release!=='all'?' AND e.release=?':''),eventArgs=[...query.args,...release!=='all'?[release]:[]];
 const [statuses,releases,environments,tags,views]=await Promise.all([
 statement('SELECT state value,COUNT(*) count FROM ranked GROUP BY state').all(),
 statement(`SELECT e.release value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project LEFT JOIN releases r ON r.project=e.project AND r.name=e.release WHERE ${eventPredicate} GROUP BY e.release ORDER BY CASE WHEN e.release='' THEN 0 ELSE 1 END,${releaseOrderSql('r')}`,...eventArgs).all(),
 statement(`SELECT e.environment value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate} GROUP BY e.environment ORDER BY count DESC,value`,...eventArgs).all(),
 statement(`SELECT t.key,CAST(t.value AS TEXT) value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project,json_each(e.payload,'$.sentry.tags') t WHERE ${eventPredicate} GROUP BY t.key,t.value ORDER BY t.key,count DESC,value LIMIT 1001`,...eventArgs).all(),
 db.prepare(`SELECT i.state value,COUNT(*) count FROM issues i WHERE ${viewWhere} GROUP BY i.state`).bind(...viewArgs).all(),
 ]);
 const stateCount=(...states:string[])=>views.results.filter((row:any)=>states.includes(row.value)).reduce((sum:number,row:any)=>sum+Number(row.count),0);
 const eventTotals=c.req.query('eventTotals')==='1'?{matchingEvents:Number((await statement(`SELECT COUNT(*) total FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate}`,...eventArgs).first() as any).total)}:{};
 return c.json({version:1,rows,total:total.total,...eventTotals,...c.get('agent')?{}:{reviewPending:total.reviewPending},next:page.results.length>size?btoa(JSON.stringify({signature,rank:last.rank,last_seen:last.last_seen,id:last.id})):null,facets:{views:{unresolved:stateCount('open','acknowledged'),all:stateCount('open','acknowledged','resolved','suppressed'),resolved:stateCount('resolved'),suppressed:stateCount('suppressed')},statuses:statuses.results,releases:releases.results,environments:environments.results,tags:tags.results.slice(0,1000),tagsComplete:tags.results.length<=1000},coverage:'Full retained project corpus. Counts are whole-issue retained occurrences. Priority sorts high, medium, then low; active regressions and new issues break ties before latest receipt. Viewing is browser-local.'});
}
routes.get('/:project/issue-search',c=>search(c));
routes.get('/:project/issue-export',c=>search(c,true));
export default routes;
