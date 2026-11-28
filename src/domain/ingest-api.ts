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
import { credentialDigest } from './credential-fence';

type CaptureBindings = Bindings & AlertEnvironment & {
 normalizeCapture?:(document:unknown)=>Promise<Envelope>;
 planCapture?:(project:string,event:Envelope)=>Promise<CapturePlan>;
 onAlertAdmitted?:(id:string)=>void;
 authorizeNative?:AuthorizeNative;
 admitNative?:(input:NativeCaptureInput,scope:IngestScope)=>Promise<Response>;
};
export type NativeCaptureMetadata = { url:string; headers:Record<string,string> };
export type NativeCaptureInput = NativeCaptureMetadata & { text:string };
export type NativeResponse = {body:string|null;status:number;headers:Record<string,string>};
export type AuthorizeNative = (input:NativeCaptureMetadata,project:string,keyHash:string)=>Promise<{scope:IngestScope}|{refusal:NativeResponse;drain:boolean}>;
export type IngestEnv = { Bindings: CaptureBindings; Variables: { project: string | null } };
type IngestContext = Context<IngestEnv>;

// Only the native routes can bypass loading the full application. It still
// mounts the same routes for URL spellings matched by its Hono router.
export function nativeIngestRoute(method: string, path: string) {
 if (method !== 'POST' && method !== 'OPTIONS') return null;
 const match = /^\/api\/ingest\/[^/]+(\/exposure)?$/.exec(path);
 if (!match) return null;
 return method === 'OPTIONS' ? 'preflight' : match[1] ? 'exposure' : 'capture';
}

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
  const key=c.req.header('authorization')?.replace(/^Bearer /,'');
  const metadata=c.env.authorizeNative||c.env.admitNative?nativeCaptureMetadata(c):undefined;
  const auth=await authorizeNativeRequest(c,c.req.param('project'),key,metadata);
  if('response' in auth)return 'drain' in auth&&!auth.drain?auth.response:ingestRejection(c,auth.response);
  const scope=auth.scope;
  const input=await readCapture(c,scope);
  if(typeof input!=='string')return input;
  if(!c.env.admitNative)return nativeAdmission(c,scope,input);
  // The admission step can revoke CORS when it detects a policy change.
  c.header('Access-Control-Allow-Origin',undefined);
  return c.env.admitNative({...metadata!,text:input},scope);
});

function nativeCaptureMetadata(c:IngestContext):NativeCaptureMetadata {
  const headers:Record<string,string>={};
  for(const header of ['origin','referer','user-agent','cf-connecting-ip']){
   const value=c.req.header(header);
   if(value!==undefined)headers[header]=value;
  }
  const url=new URL(c.req.url);
  return {url:url.origin+url.pathname,headers};
}

async function authorizeNativeRequest(c:IngestContext,project:string,key:string|undefined,metadata?:NativeCaptureMetadata) {
 if(!c.env.authorizeNative)return authorizeIngest(c,project,key);
 c.header('Vary','Origin');
 const result=await c.env.authorizeNative(metadata!,project,key?await credentialDigest(c.req.raw,key):'');
 if('refusal' in result){
  for(const [name,value] of Object.entries(result.refusal.headers))c.header(name,value);
  return {response:new Response(result.refusal.body,result.refusal),drain:result.drain};
 }
 if(result.scope.domain.cors)c.header('Access-Control-Allow-Origin',result.scope.domain.cors);
 return result;
}

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

export function captureScrubber() {
    const scrubbed = new Map<string,string>();
    return (text:string) => {
     const prior=scrubbed.get(text);
     if(prior!==undefined)return prior;
     const value=scrub(text);
     scrubbed.set(text,value);
     return value;
    };
}

export function normalizeCapture(document:unknown,clean=captureScrubber()) {
 return normalize(normalize(document,clean),clean);
}

export async function nativeAdmission(c:IngestContext,scope:IngestScope,text:string) {
  try{
    const parsed=JSON.parse(text);
    const privacy=await prepareScrubbing(c.env.DB,scope.project,parsed);
    // Use the same scrubber across the native validation passes.
    const clean=captureScrubber();
    const event=c.env.normalizeCapture ? await c.env.normalizeCapture(privacy.document) : normalizeCapture(privacy.document,clean);
    return admitEvent(c,scope,event,await hash(canonical(parsed)),false,undefined,{...privacy,clean,normalized:true,
     planCapture:c.env.planCapture,onAlertAdmitted:c.env.onAlertAdmitted,
    });
  }catch(error){return invalidCapture(c,scope,error)}
}

export const ingestApi = new Hono<IngestEnv>()
 .use('*', apiAccess)
 .onError(apiError)
 .route('/', ingestRoutes);
