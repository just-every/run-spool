import { issueAssigneeSql } from '../operators/assignment';
import { resolveMembership } from '../members/resolver';
import {pendingReview} from '../review/model';
import { Hono } from 'hono';
import { requestAuthority as ownerSession } from '../agent-door/native-authority';
import { agentProject } from '../agent-access';
import { issueAttentionSql, clientDroppedSql, decodeIssueAttention, listedIssueSql } from '../issue-attention';
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
 if(!grant)c.set('person',await ownerSession(c.req.raw,c.env,resolveMembership));
 if(!await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first())return c.json({error:'Project not found'},404);
 await next();
};
routes.use('/:project/issue-search',authorize);
routes.use('/:project/issue-export',authorize);
async function search(c:any,exporting=false){
 const project=c.req.param('project'),q=c.req.query('q')??'',state=c.req.query('status')??'all',release=c.req.query('release')??'all',sort=c.req.query('sort')??'priority';
 if(!['all','open','acknowledged','resolved','suppressed'].includes(state))throw new Error('Invalid issue status');
 if(!['priority','latest','occurrences'].includes(sort))throw new Error('Invalid issue sort');
 const query=eventQuery(q,c.get('agent')),where=['i.project=?',listedIssueSql('i')],args:any[]=[project];
 await ensureReleaseOrderKeys(c.env.DB,project);
 await ensureShortIds(c.env.DB,project);
 if(state!=='all'){where.push('i.state=?');args.push(state)}
 if(c.req.query('assignee')==='me'){if(c.get('agent'))return c.json({error:'Sign in to use Assigned to me.'},403);where.push('EXISTS(SELECT 1 FROM issue_assignments a JOIN audit_actor_links l ON l.label=a.label WHERE a.project=i.project AND a.issue=i.id AND l.owner_id=?)');args.push(c.get('person').operator.id)}
 if(query.reviewPending)where.push(pendingReview('i'));
 for(const priority of query.issuePriorities){where.push(`${prioritySql('i')}=?`);args.push(priority)}
 // A facet row already satisfies the event predicate. Only the issue-only
 // reads need the separate existence check.
 const facetFilter=where.join(' AND '),facetArgs=[...args];
 if(query.hasEventTerms||release!=='all'){where.push(`EXISTS(SELECT 1 FROM events e WHERE e.project=i.project AND e.issue=i.id AND ${query.sql}${release!=='all'?' AND e.release=?':''})`);args.push(...query.args,...release!=='all'?[release]:[])}
 const filtered=`FROM issues i WHERE ${where.join(' AND ')}`;
 const db:D1Database=c.env.DB;
 const signature=await hash(JSON.stringify([project,q,state,release,sort,c.req.query('assignee')??'all']));
 let cursor:any=null;
 if(c.req.query('cursor')){try{cursor=JSON.parse(atob(c.req.query('cursor')))}catch{throw new Error('Invalid search cursor')}if(cursor?.signature!==signature||!Number.isFinite(cursor.rank)||!Number.isFinite(cursor.last_seen)||typeof cursor.id!=='string')throw new Error('Search cursor belongs to another query')}
 const exportTotal=exporting?(await db.prepare(`SELECT COUNT(*) total ${filtered}`).bind(...args).first<{total:number}>())!.total:0;
 if(exportTotal>10000)return c.json({error:'query_export_limit',matched:exportTotal,limit:10000,action:'Narrow the query or paginate the issue-search API.'},413);
 const size=exporting?10000:25;
 const prioritySort=sort==='priority';
 const priority=`${prioritySql('i')} priority, ${issueAttentionSql}`;
 const rank=sort==='occurrences'?'count':prioritySort?"(CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)*3+CASE json_extract(attention,'$.kind') WHEN 'regression' THEN 2 WHEN 'new_issue' THEN 1 ELSE 0 END":'last_seen';
 const order='rank DESC,last_seen DESC,id DESC';
 // Resolve aliases and roll up retained occurrences only for the page being returned.
 const page=await db.prepare(`WITH scored AS (SELECT i.*${prioritySort?`, ${priority}`:''} ${filtered}),
  ranked AS (SELECT *,${rank} rank FROM scored),
  page AS MATERIALIZED (SELECT * FROM ranked ${cursor&&!exporting?'WHERE (rank,last_seen,id)<(?,?,?)':''} ORDER BY ${order} LIMIT ?)
  SELECT i.*,${prioritySort?'':`${priority},`} ${issueAssigneeSql('i')} assignee, ${pendingReview('i')} review_pending,
  ${shortIdColumnsSql('i')}, ${clientDroppedSql},
  (SELECT release FROM events WHERE project=i.project AND issue=i.id ORDER BY received DESC,id DESC LIMIT 1) last_release,
  ${issueReleasesSql('i')} releases FROM page i ORDER BY ${order}`)
  .bind(...args,...cursor&&!exporting?[cursor.rank,cursor.last_seen,cursor.id]:[],size+1).all<any>();
 const rows=page.results.slice(0,size).map((row:any)=>{const {rank,...issue}=decodeShortIds(decodeIssueAttention(row));return c.get('agent')?issueProjection(issue):ownerIssue(issue)}),last=page.results[size-1];
 if(exporting){const format=c.req.query('format')??'json';if(!['json','csv'].includes(format))throw new Error('Export format must be json or csv');
  // An export leaves the owner session: the resolving commit's SHA and release, its author and message only when shared.
  const share=(await commitSharing(db,project)).share,resolutions=new Map<string,any>((await db.prepare(`SELECT i.id,${commitResolutionSql('i')} resolution FROM issues i WHERE i.project=? AND i.id IN (SELECT value FROM json_each(?))`).bind(project,JSON.stringify(rows.map((r:any)=>r.id))).all()).results.map((r:any)=>[r.id,r.resolution?JSON.parse(r.resolution):null]));
  for(const r of rows as any[]){const resolution=resolutions.get(r.id);r.resolution_commit=resolution?.commit??null;r.resolution_citation=resolution?.citation??null;r.resolution_release=resolution?.release??null;if(share){r.resolution_author=resolution?.author?[resolution.author.name,resolution.author.email&&`<${resolution.author.email}>`].filter(Boolean).join(' '):null;r.resolution_message=resolution?.message??null}}
  const keys=['short_id','id','title','state','priority','count','first_seen','last_seen','last_release','resolution_commit','resolution_citation','resolution_release',...share?['resolution_author','resolution_message']:[]];const cell=(v:any)=>'"'+inert(String(v??'')).replaceAll('"','""')+'"';return new Response(format==='csv'?[keys.join(','),...rows.map((r:any)=>keys.map(k=>cell(r[k])).join(','))].join('\r\n'):JSON.stringify({version:1,project,query:{q,status:state,release,sort,...c.req.query('assignee')==='me'?{assignee:'me'}:{}},total:exportTotal,rows,bounds:{limit:10000,complete:true},coverage:'Retained issue aggregates; counts include all retained occurrences of matched issues.'}),{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="spool-issues.${format}"`,'Cache-Control':'no-store'}})}
 const eventPredicate=query.sql+(release!=='all'?' AND e.release=?':''),eventArgs=[...query.args,...release!=='all'?[release]:[]];
 const events='FROM events e JOIN issues i ON i.id=e.issue AND i.project=e.project';
 const eventStatement=(select:string,tail='',joins='')=>db.prepare(`SELECT ${select} ${events} ${joins}
  WHERE e.project=? AND ${facetFilter} AND ${eventPredicate} ${tail}`).bind(project,...facetArgs,...eventArgs);
 const review=c.get('agent')?'0':`SUM(${pendingReview('i')})`;
 const [statuses,releases,environments,tags,matchingEvents]=await Promise.all([
  db.prepare(`SELECT i.state value,COUNT(*) count,${review} reviewPending ${filtered} GROUP BY i.state ORDER BY i.state`).bind(...args).all<{value:string;count:number;reviewPending:number}>(),
  eventStatement('e.release value,COUNT(DISTINCT e.issue) count',`GROUP BY e.release ORDER BY CASE WHEN e.release='' THEN 0 ELSE 1 END,${releaseOrderSql('r')}`,'LEFT JOIN releases r ON r.project=e.project AND r.name=e.release').all(),
  eventStatement('e.environment value,COUNT(DISTINCT e.issue) count','GROUP BY e.environment ORDER BY count DESC,value').all(),
  eventStatement('t.key,CAST(t.value AS TEXT) value,COUNT(DISTINCT e.issue) count','GROUP BY t.key,t.value ORDER BY t.key,count DESC,value LIMIT 1001',",json_each(e.payload,'$.sentry.tags') t").all(),
  c.req.query('eventTotals')==='1'?eventStatement('COUNT(*) total').first<{total:number}>():null,
 ]);
 const totals=statuses.results.reduce((sum,row)=>({total:sum.total+row.count,reviewPending:sum.reviewPending+row.reviewPending}),{total:0,reviewPending:0});
 return c.json({version:1,rows,total:totals.total,...matchingEvents?{matchingEvents:matchingEvents.total}:{},...c.get('agent')?{}:{reviewPending:totals.reviewPending},next:page.results.length>size?btoa(JSON.stringify({signature,rank:last.rank,last_seen:last.last_seen,id:last.id})):null,facets:{statuses:statuses.results.map(({value,count})=>({value,count})),releases:releases.results,environments:environments.results,tags:tags.results.slice(0,1000),tagsComplete:tags.results.length<=1000},coverage:'Full retained project corpus. Counts are whole-issue retained occurrences. Priority sorts high, medium, then low; active regressions and new issues break ties before latest receipt. Viewing is browser-local.'});
}
routes.get('/:project/issue-search',c=>search(c));
routes.get('/:project/issue-export',c=>search(c,true));
export default routes;
