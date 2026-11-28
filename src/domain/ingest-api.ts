import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Bindings } from '../auth/bindings';
import { rejectedResponse } from '../base/rejected-response';
import type { AlertEnvironment } from './alerts/types';
import { authorizeIngest, admitEvent, recordIngest, ingestFailure, stmt } from './admission';
import { apiAccess, apiError } from './api-middleware';
import { nativeBody } from './native-wire';
import { ingestOrigin, requestedHeaders } from './origins';
import { canonical, hash, normalize, scrub } from './privacy';
import { prepareScrubbing } from './scrubbing/model';

type IngestEnv = { Bindings: Bindings & AlertEnvironment; Variables: { project: string | null } };
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
  try{
    const parsed=await nativeBody(c.req.raw);
    if('rejected' in parsed){
      try{await recordIngest(c,auth.scope,'oversized')}catch(failure){return ingestFailure(c,auth.scope,failure)}
      return ingestRejection(c,c.json({outcome:'rejected',reason:parsed.rejected===408?'body_timeout':parsed.rejected===413?'body_limit':'Body exceeds limit'},parsed.rejected as ContentfulStatusCode));
    }
    const privacy=await prepareScrubbing(c.env.DB,auth.scope.project,parsed.value);
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
    return admitEvent(c,auth.scope,normalize(privacy.document,clean),await hash(canonical(parsed.value)),false,undefined,{...privacy,clean});
  }catch(error){try{await recordIngest(c,auth.scope,'invalid')}catch(failure){return ingestFailure(c,auth.scope,failure)}return ingestRejection(c,c.json({outcome:'rejected',reason:scrub((error as Error).message)},400))}
});

export const ingestApi = new Hono<IngestEnv>()
 .use('*', apiAccess)
 .onError(apiError)
 .route('/', ingestRoutes);
