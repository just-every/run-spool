import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from '../auth/bindings';
import { rejectedResponse } from '../base/rejected-response';
import type { AlertEnvironment } from './alerts/types';
import { authorizeIngest, admitEvent, recordIngest, ingestFailure, stmt, type IngestScope } from './admission';
import { apiAccess, apiError } from './api-middleware';
import { nativeBody } from './native-wire';
import { ingestOrigin, requestedHeaders } from './origins';
import { canonical, hash, normalize, scrub, type Envelope } from './privacy';
import { prepareScrubbing } from './scrubbing/model';
import type { CapturePlan } from './capture-evidence';

type CaptureBindings = Bindings & AlertEnvironment & {
 planCapture?:(project:string,event:Envelope)=>Promise<CapturePlan>;
 onAlertAdmitted?:(id:string)=>void;
 admitNative?:(input:NativeCaptureInput,scope:IngestScope)=>Promise<Response>;
};
export type NativeCaptureInput = { url:string; headers:Record<string,string>; text:string };
export type IngestEnv = { Bindings: CaptureBindings; Variables: { project: string | null } };
type IngestContext = Context<IngestEnv>;

// Only the native routes can bypass loading the full application. It still
// mounts the same routes for URL spellings matched by its Hono router.
export const isNativeIngest = (method: string, path: string) =>
 (method === 'POST' || method === 'OPTIONS') && /^\/api\/ingest\/[^/]+(?:\/exposure)?$/.test(path);

async function ingestRejection(c:IngestContext,response:Response) {
  const result=await rejectedResponse(c.req.raw,response);
  if(result.status===408||result.status===413)return c.json({outcome:'rejected',reason:result.status===408?'body_timeout':'body_limit'},result.status);
  return result;
}

export const ingestRoutes = new Hono<IngestEnv>();
const preflight=async(c:Context<IngestEnv, '/api/ingest/:project'>)=>{
  c.header('Vary','Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
  const project=c.req.param('project'),origin=c.req.header('origin');
  const known=await stmt(c.env.DB,'SELECT 1 FROM projects WHERE id=?',project).first();
  if(!known||!origin||c.req.header('access-control-request-method')!=='POST'||!requestedHeaders(c.req.header('access-control-request-headers')))return c.json({error:'Preflight not allowed'},403);
  const policy=await ingestOrigin(c.env.DB,project,origin,c.env.AUTH_ORIGIN,c.req.header('referer'));
  if(!policy.allowed)return c.json({error:'Origin not allowed'},403);
  c.header('Access-Control-Allow-Origin',origin);c.header('Access-Control-Allow-Methods','POST');c.header('Access-Control-Allow-Headers','Authorization, Content-Type');c.header('Access-Control-Max-Age','60');return c.body(null,204);
};
ingestRoutes.options('/api/ingest/:project',preflight);
ingestRoutes.options('/api/ingest/:project/exposure',preflight);
ingestRoutes.post('/api/ingest/:project/exposure',async c => (await import('./exposure/intake')).exposureResponse(c));
ingestRoutes.post('/api/ingest/:project',async c=>{
  const auth=await authorizeIngest(c,c.req.param('project'),c.req.header('authorization')?.replace(/^Bearer /,''));
  if('response' in auth)return ingestRejection(c,auth.response);
  const scope=auth.scope;
  const input=await readCapture(c,scope);
  if(typeof input!=='string')return input;
  if(!c.env.admitNative)return nativeAdmission(c,scope,input);
  const headers:Record<string,string>={};
  for(const header of ['origin','referer','user-agent','cf-connecting-ip']){
   const value=c.req.header(header);
   if(value!==undefined)headers[header]=value;
  }
  const url=new URL(c.req.url);
  // The admission step can revoke CORS when it detects a policy change.
  c.header('Access-Control-Allow-Origin',undefined);
  return c.env.admitNative({url:url.origin+url.pathname,headers,text:input},scope);
});

async function invalidCapture(c:IngestContext,scope:IngestScope,error:unknown) {
 try{await recordIngest(c,scope,'invalid')}catch(failure){return ingestFailure(c,scope,failure)}
 return ingestRejection(c,c.json({outcome:'rejected',reason:scrub((error as Error).message)},400));
}

async function readCapture(c:IngestContext,scope:IngestScope) {
 try {
  const input=await nativeBody(c.req.raw);
  if('text' in input)return input.text;
  try{await recordIngest(c,scope,'oversized')}catch(failure){return ingestFailure(c,scope,failure)}
  return ingestRejection(c,c.json({outcome:'rejected',reason:input.rejected===408?'body_timeout':input.rejected===413?'body_limit':'Body exceeds limit'},input.rejected as ContentfulStatusCode));
 } catch(error) { return invalidCapture(c,scope,error); }
}

export async function nativeAdmission(c:IngestContext,scope:IngestScope,text:string) {
  try{
    const parsed=JSON.parse(text);
    const privacy=await prepareScrubbing(c.env.DB,scope.project,parsed);
    // Normalization is repeated around release and grouping policy. Cache
    // identical strings in this capture so every pass uses the same scrubber.
    const scrubbed = new Map<string,string>();
    const clean = (text:string) => {
     const prior=scrubbed.get(text);
     if(prior!==undefined)return prior;
     const value=scrub(text);
     scrubbed.set(text,value);
     return value;
    };
    return admitEvent(c,scope,normalize(privacy.document,clean),await hash(canonical(parsed)),false,undefined,{...privacy,clean,
     planCapture:c.env.planCapture,onAlertAdmitted:c.env.onAlertAdmitted,
    });
  }catch(error){return invalidCapture(c,scope,error)}
}

export const ingestApi = new Hono<IngestEnv>()
 .use('*', apiAccess)
 .onError(apiError)
 .route('/', ingestRoutes);
