import { streamIssueExport } from './issue-export';
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
import { ensureReleaseOrderKeys } from '../releases/order';
import { ensureShortIds } from '../short-ids/assign';
import { decodeShortIds, shortIdColumnsSql } from '../short-ids/lookup';
const routes=new Hono<any>();
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
 if(!['all','open','acknowledged','resolved','suppressed'].includes(state))throw new Error('Invalid issue status');
 if(!['priority','latest','occurrences'].includes(sort))throw new Error('Invalid issue sort');
 const query=eventQuery(q,c.get('agent')),where=['i.project=?'],args:any[]=[project];
 if(query.usesLatest)await ensureReleaseOrderKeys(c.env.DB,project);
 await ensureShortIds(c.env.DB,project);
 if(state!=='all'){where.push('i.state=?');args.push(state)}
 if(query.reviewPending)where.push(pendingReview('i'));
 for(const priority of query.issuePriorities){where.push(`${prioritySql('i')}=?`);args.push(priority)}
 if(query.hasEventTerms||release!=='all'){where.push(`EXISTS(SELECT 1 FROM events e WHERE e.project=i.project AND e.issue=i.id AND ${query.sql}${release!=='all'?' AND e.release=?':''})`);args.push(...query.args,...release!=='all'?[release]:[])}
 const filtered=`SELECT i.*, ${prioritySql('i')} priority, ${pendingReview('i')} review_pending, ${shortIdColumnsSql('i')}, ${issueAttentionSql}, ${clientDroppedSql}, (SELECT release FROM events WHERE project=i.project AND issue=i.id ORDER BY received DESC,id DESC LIMIT 1) last_release,(SELECT json_group_array(DISTINCT release) FROM events WHERE project=i.project AND issue=i.id) releases FROM issues i WHERE ${where.join(' AND ')}`;
 const cte=`WITH filtered AS (${filtered}), ranked AS (SELECT *,${sort==='occurrences'?'count':sort==='priority'?"(CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END)*3+CASE json_extract(attention,'$.kind') WHEN 'regression' THEN 2 WHEN 'new_issue' THEN 1 ELSE 0 END":'last_seen'} rank FROM filtered)`;
 const db=c.env.DB,statement=(sql:string,...extra:any[])=>db.prepare(cte+' '+sql).bind(...args,...extra);
 const signature=await hash(JSON.stringify([project,q,state,release,sort]));
 let cursor:any=null;
 if(c.req.query('cursor')){try{cursor=JSON.parse(atob(c.req.query('cursor')))}catch{throw new Error('Invalid search cursor')}if(cursor?.signature!==signature||!Number.isFinite(cursor.rank)||!Number.isFinite(cursor.last_seen)||typeof cursor.id!=='string')throw new Error('Search cursor belongs to another query')}
 const total=await statement('SELECT COUNT(*) total,COALESCE(SUM(review_pending),0) reviewPending FROM ranked').first() as any;
 if(exporting)return streamIssueExport(c,{project,query:{q,status:state,release,sort},total:total.total,page:async after=>{
  const page=await statement(`SELECT * FROM ranked ${after?'WHERE (rank,last_seen,id)<(?,?,?)':''} ORDER BY rank DESC,last_seen DESC,id DESC LIMIT 100`,...after?[after.rank,after.last_seen,after.id]:[]).all();
  return {rows:page.results.map((row:any)=>{const {rank,...issue}=decodeShortIds(decodeIssueAttention(row));return c.get('agent')?issueProjection(issue):ownerIssue(issue)}),position:page.results.at(-1)};
 }});
 const size=25;
 const page=await statement(`SELECT * FROM ranked ${cursor?'WHERE (rank,last_seen,id)<(?,?,?)':''} ORDER BY rank DESC,last_seen DESC,id DESC LIMIT ?`,...cursor?[cursor.rank,cursor.last_seen,cursor.id]:[],size+1).all();
 const rows=page.results.slice(0,size).map((row:any)=>{const {rank,...issue}=decodeShortIds(decodeIssueAttention(row));return c.get('agent')?issueProjection(issue):ownerIssue(issue)}),last=page.results[size-1];
 const eventPredicate=query.sql+(release!=='all'?' AND e.release=?':''),eventArgs=[...query.args,...release!=='all'?[release]:[]];
 const [statuses,releases,environments,tags]=await Promise.all([
 statement('SELECT state value,COUNT(*) count FROM ranked GROUP BY state').all(),
 statement(`SELECT e.release value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate} GROUP BY e.release ORDER BY count DESC,value`,...eventArgs).all(),
 statement(`SELECT e.environment value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate} GROUP BY e.environment ORDER BY count DESC,value`,...eventArgs).all(),
 statement(`SELECT t.key,CAST(t.value AS TEXT) value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project,json_each(e.payload,'$.sentry.tags') t WHERE ${eventPredicate} GROUP BY t.key,t.value ORDER BY t.key,count DESC,value LIMIT 1001`,...eventArgs).all(),
 ]);
 const eventTotals=c.req.query('eventTotals')==='1'?{matchingEvents:Number((await statement(`SELECT COUNT(*) total FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate}`,...eventArgs).first() as any).total)}:{};
 return c.json({version:1,rows,total:total.total,...eventTotals,...c.get('agent')?{}:{reviewPending:total.reviewPending},next:page.results.length>size?btoa(JSON.stringify({signature,rank:last.rank,last_seen:last.last_seen,id:last.id})):null,facets:{statuses:statuses.results,releases:releases.results,environments:environments.results,tags:tags.results.slice(0,1000),tagsComplete:tags.results.length<=1000},coverage:'Full retained project corpus. Counts are whole-issue retained occurrences. Priority sorts high, medium, then low; active regressions and new issues break ties before latest receipt. Viewing is browser-local.'});
}
routes.get('/:project/issue-search',c=>search(c));
routes.get('/:project/issue-export',c=>search(c,true));
export default routes;
