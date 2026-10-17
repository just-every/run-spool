import { Hono } from 'hono';
import type { Bindings } from '../../auth/bindings';
import { canonical, hash, scrub } from '../privacy';
import { authorizeIngest, admitEvent, recordIngest, ingestBatch, ingestFailure, outcomeStatement, type IngestScope } from '../admission';
import { ingestOrigin } from '../origins';
import { sentryKey } from './auth.ts';
import { convertSentry } from './convert.ts';
import { feedbackInput } from '../feedback/input';
import { admitFeedback } from '../feedback/admission';
import { clientReportCounts } from './client-reports';
import { SentryWireError, readSentryBytes, parseEnvelope, objectJson, unsupportedReason } from './wire.ts';
const routes=new Hono<{Bindings:Bindings}>();
const paths=['/:alias/envelope/','/:alias/envelope','/:alias/store/','/:alias/store'];
routes.on('OPTIONS',paths,async c=>{
  c.header('Vary','Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  const alias=c.req.param('alias')!,origin=c.req.header('origin'),requested=c.req.header('access-control-request-headers')??'';
  const headers=requested?requested.toLowerCase().split(',').map(v=>v.trim()):[];
  if(!/^[1-9][0-9]{0,15}$/.test(alias)||!origin||c.req.header('access-control-request-method')!=='POST'||requested.length>256||new Set(headers).size!==headers.length||headers.some(h=>!['content-type','x-sentry-auth','authorization'].includes(h)))return c.json({error:'Preflight not allowed'},403);
  const row=await c.env.DB.prepare('SELECT project FROM sentry_project_aliases WHERE id=?').bind(alias).first<{project:string}>();
  if(!row||!(await ingestOrigin(c.env.DB,row.project,origin,c.env.AUTH_ORIGIN,c.req.header('referer'))).allowed)return c.json({error:'Origin not allowed'},403);
  c.header('Access-Control-Allow-Origin',origin);c.header('Access-Control-Allow-Methods','POST');c.header('Access-Control-Allow-Headers','Content-Type, X-Sentry-Auth, Authorization');c.header('Access-Control-Max-Age','60');return c.body(null,204);
});
routes.on('POST',paths,async c=>{
  c.header('Vary','Origin');c.header('Access-Control-Expose-Headers','Retry-After, X-Sentry-Rate-Limits, X-Sentry-Error');
  let scope:IngestScope|undefined;
  try{
    const bytes=await readSentryBytes(c.req.raw),store=/\/store\/?$/.test(c.req.path);
    // Parse ALL item byte boundaries before authenticating, counting or admitting anything.
    const envelope=store?{header:{},items:[{header:{type:'event'},bytes}]}:parseEnvelope(bytes);
    const key=sentryKey(c.req.raw,c.req.param('alias')!,envelope.header);
    const row=await c.env.DB.prepare('SELECT project FROM sentry_project_aliases WHERE id=?').bind(c.req.param('alias')!).first<{project:string}>();
    if(!row)throw new SentryWireError('invalid_ingest_key',401);
    const auth=await authorizeIngest(c,row.project,key);if('response' in auth)return auth.response;scope=auth.scope;
    const dropped=new Map<string,number>(),clientDiscarded=new Map<string,number>(),events=[],feedback=[];
    let clientReports=0,invalidReports=0;
    for(const item of envelope.items){
      if(item.header.type==='client_report'){
        clientReports++;
        try{for(const [reason,count] of clientReportCounts(item.bytes))clientDiscarded.set(reason,(clientDiscarded.get(reason)??0)+count)}
        catch(error){if(!(error instanceof SentryWireError))throw error;invalidReports++;dropped.set('client_report_invalid',invalidReports)}
        continue;
      }
      if(item.header.type==='feedback'||item.header.type==='user_report'){
        feedback.push(await feedbackInput(objectJson(item.bytes),item.header.type,envelope.header.event_id));continue;
      }
      if(item.header.type!=='event'){const reason=unsupportedReason(item.header.type);dropped.set(reason,(dropped.get(reason)??0)+1);continue}
      const raw=objectJson(item.bytes);
      if(raw.type==='feedback'){feedback.push(await feedbackInput(raw,'feedback',envelope.header.event_id));continue}
      if(raw.type!==undefined&&raw.type!=='error'){
        if(store)throw new SentryWireError('unsupported_event_type',422);
        const reason=unsupportedReason(typeof raw.type==='string'?raw.type:'unknown');dropped.set(reason,(dropped.get(reason)??0)+1);continue;
      }
      events.push({event:convertSentry(raw,envelope.header.event_id),digest:await hash(canonical(raw))});
    }
    if(dropped.size||clientDiscarded.size)await ingestBatch(c,scope,[...dropped,...clientDiscarded].map(([reason,count])=>outcomeStatement(c.env.DB,scope!.project,reason,count)));
    let id:string|undefined;
    for(const {event,digest} of events){const response=await admitEvent(c,scope,event,digest);if(!response.ok){const result=await response.json() as any;c.header('X-Sentry-Error',String(result.reason??result.outcome));return c.json(result,response.status as any)}id=event.eventId}
    const receipts=[];
    // Admit errors first so feedback in the same envelope can bind their exact occurrence.
    for(const report of feedback){const response=await admitFeedback(c,scope,report),result=await response.json();if(!response.ok){c.header('X-Sentry-Error',String((result as any).reason??(result as any).outcome));return c.json(result,response.status as any)}receipts.push(result);id??=report.id}
    return c.json({...id?{id}:{},dropped:Object.fromEntries(dropped),...clientReports?{clientReports:{received:clientReports-invalidReports,invalid:invalidReports,discarded:Object.fromEntries(clientDiscarded)}}:{},...receipts.length?{feedback:receipts}:{}},200);
  }catch(error){
    if(error instanceof SentryWireError){
      if(scope){try{await recordIngest(c,scope,error.reason.includes('feedback')?error.status===413?'feedback_oversized':'feedback_invalid':error.reason==='missing_release_register_required'?error.reason:error.status===413?'oversized':'invalid')}catch(failure){return ingestFailure(c,scope,failure)}}
      c.header('X-Sentry-Error',error.reason);return c.json({outcome:'rejected',reason:error.reason,...error.reason==='missing_release_register_required'&&scope?{register:`/projects/${encodeURIComponent(scope.project)}/releases`}:{}},error.status as any);
    }
    if(scope){if(String((error as Error).message).startsWith('D1'))return ingestFailure(c,scope,error);await recordIngest(c,scope,'invalid')}
    return c.json({outcome:'rejected',reason:scrub((error as Error).message)},400);
  }
});
export default routes;
