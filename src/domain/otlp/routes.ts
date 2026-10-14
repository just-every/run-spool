import { Hono } from 'hono';
import type { Bindings } from '../../auth/bindings';
import { rejectedResponse } from '../../base/rejected-response';
import { authorizeIngest, admitEvent, recordIngest, ingestFailure, type IngestScope } from '../admission';
import { ingestOrigin, requestedHeaders } from '../origins';
import { candidates, prepare } from './convert';
import { OtlpError, readOtlp } from './wire';
const routes=new Hono<{Bindings:Bindings}>();
const path='/:project/v1/logs';
routes.options(path,async c=>{
  c.header('Vary','Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  const project=c.req.param('project'),origin=c.req.header('origin');
  const known=await c.env.DB.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first();
  if(!known||!origin||c.req.header('access-control-request-method')!=='POST'||!requestedHeaders(c.req.header('access-control-request-headers'))||!(await ingestOrigin(c.env.DB,project,origin,c.env.AUTH_ORIGIN)).allowed)return c.json({message:'preflight_not_allowed'},403);
  c.header('Access-Control-Allow-Origin',origin);c.header('Access-Control-Allow-Methods','POST');c.header('Access-Control-Allow-Headers','Authorization, Content-Type');c.header('Access-Control-Max-Age','60');return c.body(null,204);
});
routes.post(path,async c=>{
  c.header('Access-Control-Expose-Headers','Retry-After');let scope:IngestScope|undefined;
  const failure=async(response:Response)=>{
    if(response.status===408||response.status===413)return c.json({message:response.status===408?'body_timeout':'body_limit'},response.status);
    const body=await response.json() as {reason?:string};
    if(response.status===429)c.header('Retry-After',response.headers.get('Retry-After')??'60');
    return c.json({message:body.reason??'ingest_rejected'},response.status as any);
  };
  try{
    const bearer=c.req.header('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    const auth=await authorizeIngest(c,c.req.param('project'),bearer);if('response' in auth)return failure(await rejectedResponse(c.req.raw,auth.response));scope=auth.scope;
    const input=candidates(await readOtlp(c.req.raw));
    const prepared=await Promise.all(input.map(prepare));
    let rejected=0;const reasons=new Set<string>();
    for(const item of prepared){
      if('reason' in item){await recordIngest(c,scope,'invalid');rejected++;reasons.add(item.reason);continue}
      const response=await admitEvent(c,scope,item.event,item.digest);
      if(response.ok)continue;
      if(response.status===409||response.status===422){const body=await response.json() as {reason?:string};rejected++;reasons.add(response.status===409?'event_id_conflict':body.reason??'invalid_native_event');continue}
      return failure(response);
    }
    return c.json(rejected?{partialSuccess:{rejectedLogRecords:String(rejected),errorMessage:[...reasons].sort().join(', ')}}:{},200);
  }catch(error){
    if(error instanceof OtlpError){
      if(scope){try{await recordIngest(c,scope,error.status===413?'oversized':'invalid')}catch(failureError){return failure(await ingestFailure(c,scope,failureError))}}
      return c.json({message:error.reason},error.status as any);
    }
    if(scope)return failure(await ingestFailure(c,scope,error));
    return c.json({message:'transaction_not_confirmed'},503);
  }
});
export default routes;
