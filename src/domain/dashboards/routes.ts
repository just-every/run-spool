import {Hono} from 'hono';
import {ownerSession,ownerWrite} from '../../auth/session.server';
import {AuthError} from '../../modules/operator-auth/index.mjs';
import {resolveMembership} from '../members/resolver';
import {ownerBatch,type OwnerSession} from '../owner-authority';
import {auditCommit} from '../audit';
import {jsonBody} from '../owner-router';
import {identity} from '../privacy';
import {fail,fields,metricConfig,window} from './input';
import {canRead,currentProjects,finishRead,itemRevisionGuard,loadItem,projectGuards,s,type ProjectSnapshot} from './authority';
import {saveItem,shareItem,deleteItem} from './mutations';
import {itemView} from './view';
import {widgetMetric} from './metrics';
import {eventTable} from './tables';
import {itemExport} from './export';

export const reportingRoutes=new Hono<any>();
reportingRoutes.use('*',async(c,next)=>{
 c.header('Cache-Control','no-store');c.header('X-Content-Type-Options','nosniff');
 if(c.req.header('authorization'))return c.json({error:'Project scope required'},403);
 const session=await ownerSession(c.req.raw,c.env,resolveMembership);
 if(!session)return c.json({error:'Sign in required'},401);
 if(session.membership?.role==='billing')return c.json({error:'Reporting item not found'},404);
 if(!['GET','HEAD'].includes(c.req.method)&&!ownerWrite(c.req.raw,c.env))return c.json({error:'Same-origin required'},403);
 c.set('reportingSession',session);await next();
});
const session=(c:any):OwnerSession=>c.get('reportingSession');
async function admitted(c:any){
 const projects=await currentProjects(c.env.DB,session(c)),snapshot=await loadItem(c.env.DB,identity(c.req.param('id'),'reporting item'));
 if(!canRead(session(c),snapshot,projects))return fail('Reporting item not found',404);
 return {projects,snapshot};
}
async function show(c:any,exporting=false){
 const {projects,snapshot}=await admitted(c),result=await itemView(c.env.DB,session(c),snapshot,projects,true,exporting);
 // Export construction can refuse its bounds before a successful export fact.
 const response=exporting?itemExport(result.view,c.req.query('format')??'json'):c.json(result.view);
 await ownerBatch(c.env.DB,session(c),[...projectGuards(c.env.DB,session(c),snapshot.projects.filter(id=>projects.has(id)).map(id=>projects.get(id)!)),itemRevisionGuard(c.env.DB,snapshot.row),...result.viewGuards,auditCommit(c.env.DB)]);
 return response;
}
reportingRoutes.get('/items',async c=>{
 const db=c.env.DB,who=session(c),projects=await currentProjects(db,who),ids=(await s(db,'SELECT id FROM spool_reporting_items ORDER BY updated DESC,id').all<{id:string}>()).results;
 const rows=await Promise.all(ids.map(async ({id})=>loadItem(db,id))),visible=rows.filter(row=>canRead(who,row,projects));
 const items=await Promise.all(visible.map(async row=>(await itemView(db,who,row,projects)).view));
 await finishRead(db,who,[...new Map(visible.flatMap(row=>row.projects.filter(id=>projects.has(id)).map(id=>[id,projects.get(id)!] as const))).values()],visible.map(row=>row.row));
 return c.json({items,limits:{itemsPerKindPerOrganization:25,widgetsPerItem:12}});
});
reportingRoutes.post('/items',async c=>{
 const projects=await currentProjects(c.env.DB,session(c)),id=await saveItem(c.env.DB,session(c),projects,await jsonBody(c.req.raw,32768));
 const snapshot=await loadItem(c.env.DB,id),result=await itemView(c.env.DB,session(c),snapshot,projects,true);
 await finishRead(c.env.DB,session(c),snapshot.projects.map(id=>projects.get(id)!),[snapshot.row]);return c.json(result.view,201);
});
reportingRoutes.get('/items/:id',c=>show(c));
reportingRoutes.get('/items/:id/open',async c=>{
 const {projects,snapshot}=await admitted(c),visible=snapshot.projects.filter(id=>projects.has(id));
 await finishRead(c.env.DB,session(c),visible.map(id=>projects.get(id)!),[snapshot.row]);
 return c.redirect(`/projects/${encodeURIComponent(visible[0])}/reports?item=${encodeURIComponent(snapshot.row.id)}`,303);
});
reportingRoutes.get('/items/:id/run',c=>show(c));
reportingRoutes.get('/items/:id/export',c=>show(c,true));
reportingRoutes.put('/items/:id',async c=>{
 const {projects,snapshot}=await admitted(c);await saveItem(c.env.DB,session(c),projects,await jsonBody(c.req.raw,32768),snapshot);return show(c);
});
reportingRoutes.delete('/items/:id',async c=>{
 const {projects,snapshot}=await admitted(c);await deleteItem(c.env.DB,session(c),projects,snapshot,await jsonBody(c.req.raw,2048));return c.json({deleted:true});
});
reportingRoutes.put('/items/:id/shares',async c=>{
 const {projects,snapshot}=await admitted(c);await shareItem(c.env.DB,session(c),projects,snapshot,await jsonBody(c.req.raw,8192));return show(c);
});
reportingRoutes.post('/preview',async c=>{
 const body=await jsonBody(c.req.raw,4096);fields(body,['project','config']);const project=identity(body.project,'project'),projects=await currentProjects(c.env.DB,session(c)),selected=projects.get(project);
 if(!selected)fail('Project not found',404);
 const data=await widgetMetric(c.env.DB,project,metricConfig(body.config));await finishRead(c.env.DB,session(c),[selected!]);return c.json(data);
});
reportingRoutes.post('/table-preview',async c=>{
 const body=await jsonBody(c.req.raw,4096);fields(body,['project','query','from','to']);const project=identity(body.project,'project'),projects=await currentProjects(c.env.DB,session(c)),selected:ProjectSnapshot|undefined=projects.get(project);
 if(!selected)fail('Project not found',404);
 const data=await eventTable(c.env.DB,project,body.query,window(body,true));await finishRead(c.env.DB,session(c),[selected!]);return c.json(data);
});
reportingRoutes.onError((error,c)=>{
 if(error instanceof AuthError)return c.json({error:error.code},error.status as any);
 if(/^(?:Only validated query fields|Invalid saved query|Search|Unsupported search|Use a positive report window|Invalid request body|Request body too large)/.test(error.message))return c.json({error:error.message},400);
 throw error;
});
