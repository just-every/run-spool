import { authorizeIngest, ingestFailure, recordIngest } from '../admission';
import { rejectedResponse } from '../../base/rejected-response';
import { readSentryBytes, objectJson, SentryWireError } from '../sentry/wire';
import { admitSessions } from './intake';

// Native SDKs share the session parser, project bucket, filters and custody with Sentry.
export async function nativeSessionResponse(c:any) {
 const auth=await authorizeIngest(c,c.req.param('project'),c.req.header('authorization')?.replace(/^Bearer /,''));
 if('response' in auth)return rejectedResponse(c.req.raw,auth.response);
 c.header('Access-Control-Expose-Headers','X-Sentry-Rate-Limits');
 try {
  const bytes=await readSentryBytes(c.req.raw);
  const metadata=bytes.byteLength<=102400?objectJson(bytes).sdk:undefined;
  const sdk=metadata?.name==='spool.javascript'&&typeof metadata.version==='string'&&/^[\w.-]{1,40}$/.test(metadata.version)?{name:metadata.name,version:metadata.version}:undefined;
  const {counts,retryAfter}=await admitSessions(c,auth.scope,[{header:{type:'session'},bytes}],sdk);
  if(retryAfter)c.header('X-Sentry-Rate-Limits',`${retryAfter}:session:project:session_rate_limited`);
  const reason=Object.keys(counts)[0];
  return c.json({outcome:reason==='session_stored'?'accepted':['session_rate_limited','session_capacity'].includes(reason)?'dropped':'rejected',reason});
 } catch(error) {
  if(!(error instanceof SentryWireError))return ingestFailure(c,auth.scope,error);
  const reason=error.status===413?'session_item_too_large':'session_invalid';
  try { await recordIngest(c,auth.scope,reason); } catch(failure) { return ingestFailure(c,auth.scope,failure); }
  return rejectedResponse(c.req.raw,c.json({outcome:'rejected',reason},error.status as any));
 }
}
