import { Hono } from 'hono';
import { ownerSession } from '../../auth/session.server';
import { agentProject } from '../agent-access';
import { issueAttentionSql, clientDroppedSql, decodeIssueAttention } from '../issue-attention';
import { issueProjection } from '../agent-projection';
import { ownerIssue } from '../stored-text';
import { hash } from '../privacy';
import { eventQuery } from './query';
import { ensureReleaseOrderKeys } from '../releases/order';
const routes=new Hono<any>();
// Independently enforce the read door; mounting this router never supplies authority.
const authorize=async(c:any,next:any)=>{
 const project=c.req.param('project'),grant=await agentProject(c.req.raw,c.env.DB);
 if(grant!==project&&!await ownerSession(c.req.raw,c.env))return c.json({error:'Sign in required'},401);
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
 const query=eventQuery(q),where=['i.project=?'],args:any[]=[project];
 if(query.usesLatest)await ensureReleaseOrderKeys(c.env.DB,project);
 if(state!=='all'){where.push('i.state=?');args.push(state)}
 if(q||release!=='all'){where.push(`EXISTS(SELECT 1 FROM events e WHERE e.project=i.project AND e.issue=i.id AND ${query.sql}${release!=='all'?' AND e.release=?':''})`);args.push(...query.args,...release!=='all'?[release]:[])}
 const filtered=`SELECT i.*, ${issueAttentionSql}, ${clientDroppedSql}, (SELECT release FROM events WHERE project=i.project AND issue=i.id ORDER BY received DESC,id DESC LIMIT 1) last_release,(SELECT json_group_array(DISTINCT release) FROM events WHERE project=i.project AND issue=i.id) releases FROM issues i WHERE ${where.join(' AND ')}`;
 const cte=`WITH filtered AS (${filtered}), ranked AS (SELECT *,${sort==='occurrences'?'count':sort==='priority'?"CASE json_extract(attention,'$.kind') WHEN 'regression' THEN 2 WHEN 'new_issue' THEN 1 ELSE 0 END":'last_seen'} rank FROM filtered)`;
 const db=c.env.DB,statement=(sql:string,...extra:any[])=>db.prepare(cte+' '+sql).bind(...args,...extra);
 const signature=await hash(JSON.stringify([project,q,state,release,sort]));
 let cursor:any=null;
 if(c.req.query('cursor')){try{cursor=JSON.parse(atob(c.req.query('cursor')))}catch{throw new Error('Invalid search cursor')}if(cursor?.signature!==signature||!Number.isFinite(cursor.rank)||!Number.isFinite(cursor.last_seen)||typeof cursor.id!=='string')throw new Error('Search cursor belongs to another query')}
 const total=await statement('SELECT COUNT(*) total FROM ranked').first() as any;
 if(exporting&&total.total>10000)return c.json({error:'query_export_limit',matched:total.total,limit:10000,action:'Narrow the query or paginate the issue-search API.'},413);
 const size=exporting?10000:25;
 const page=await statement(`SELECT * FROM ranked ${cursor&&!exporting?'WHERE (rank,last_seen,id)<(?,?,?)':''} ORDER BY rank DESC,last_seen DESC,id DESC LIMIT ?`,...cursor&&!exporting?[cursor.rank,cursor.last_seen,cursor.id]:[],size+1).all();
 const rows=page.results.slice(0,size).map((row:any)=>{const {rank,...issue}=decodeIssueAttention(row);return c.get('agent')?issueProjection(issue):ownerIssue(issue)}),last=page.results[size-1];
 if(exporting){const format=c.req.query('format')??'json';if(!['json','csv'].includes(format))throw new Error('Export format must be json or csv');const keys=['id','title','state','count','first_seen','last_seen','last_release'];const cell=(v:any)=>'"'+String(v??'').replaceAll('"','""')+'"';return new Response(format==='csv'?[keys.join(','),...rows.map((r:any)=>keys.map(k=>cell(r[k])).join(','))].join('\r\n'):JSON.stringify({version:1,project,query:{q,status:state,release,sort},total:total.total,rows,bounds:{limit:10000,complete:true},coverage:'Retained issue aggregates; counts include all retained occurrences of matched issues.'}),{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json','Content-Disposition':`attachment; filename="spool-issues.${format}"`,'Cache-Control':'no-store'}})}
 const eventPredicate=query.sql+(release!=='all'?' AND e.release=?':''),eventArgs=[...query.args,...release!=='all'?[release]:[]];
 const [statuses,releases,environments,tags]=await Promise.all([
 statement('SELECT state value,COUNT(*) count FROM ranked GROUP BY state').all(),
 statement(`SELECT e.release value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate} GROUP BY e.release ORDER BY count DESC,value`,...eventArgs).all(),
 statement(`SELECT e.environment value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project WHERE ${eventPredicate} GROUP BY e.environment ORDER BY count DESC,value`,...eventArgs).all(),
 statement(`SELECT t.key,CAST(t.value AS TEXT) value,COUNT(DISTINCT e.issue) count FROM events e JOIN ranked i ON i.id=e.issue AND i.project=e.project,json_each(e.payload,'$.sentry.tags') t WHERE ${eventPredicate} GROUP BY t.key,t.value ORDER BY t.key,count DESC,value LIMIT 1001`,...eventArgs).all(),
 ]);
 return c.json({version:1,rows,total:total.total,next:page.results.length>size?btoa(JSON.stringify({signature,rank:last.rank,last_seen:last.last_seen,id:last.id})):null,facets:{statuses:statuses.results,releases:releases.results,environments:environments.results,tags:tags.results.slice(0,1000),tagsComplete:tags.results.length<=1000},coverage:'Full retained project corpus. Counts are whole-issue retained occurrences. Priority means active regressions, then new issues; viewing is browser-local.'});
}
routes.get('/:project/issue-search',c=>search(c));
routes.get('/:project/issue-export',c=>search(c,true));
export default routes;
