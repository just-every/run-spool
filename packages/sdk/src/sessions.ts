import { client, identity } from '../../../src/domain/privacy.ts';
import { currentFetch, settle } from '../../../src/domain/capture.ts';
import type { SessionResult, SessionStatus, SpoolOptions, SpoolSession } from './types.ts';
declare const __SPOOL_SDK_VERSION__:string;

/** Explicit sessions work without installing automatic error handlers. No identity is invented. */
export function startSession(options:SpoolOptions):SpoolSession {
 let target:{endpoint:string;project:string;key:string;release:string;environment:string;did?:string}|undefined,transport:typeof fetch|undefined;
 let sid='',sampled=true,invalid=false;
 let callback:SpoolOptions['onSessionOutcome'];
 try {
  callback=options.onSessionOutcome;
  const endpoint=new URL(options.endpoint);
  if(!['http:','https:'].includes(endpoint.protocol)||endpoint.username||endpoint.password||typeof options.ingestKey!=='string'||!options.ingestKey)throw Error();
  const sample=options.sessionSampleRate??1;
  if(typeof sample!=='number'||!Number.isFinite(sample)||sample<0||sample>1)throw Error();
  sampled=Math.random()<sample;
  target={endpoint:endpoint.origin,project:identity(options.project,'project'),key:options.ingestKey,release:identity(options.release,'release'),environment:identity(options.environment??'production','environment'),...options.client!==undefined?{did:client(options.client)}:{}};
  sid=[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
  transport=currentFetch();
 } catch { invalid=true; }
 const result=(outcome:SessionResult['outcome'],reason?:string):SessionResult=>({outcome,sid,...reason?{reason}:{}});
 const notify=(value:SessionResult)=>settle(value,callback);
 const started=Date.now();let status='ok',errors=0,ended=false,retryUntil=0;
 let pending:Promise<SessionResult>|undefined,latest:string|undefined;
 let final:Promise<SessionResult>|undefined;
 const transmit=async(body:string):Promise<SessionResult>=>{
   if(invalid||!target)return result('rejected','invalid_options');
   if(!sampled)return result('dropped','session_sampled');
   if(Date.now()<retryUntil)return result('dropped','session_rate_limited');
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try {
    const work=async()=>{
    const response=await Reflect.apply(transport!,globalThis,[`${target!.endpoint}/api/ingest/${encodeURIComponent(target!.project)}/sessions`,{method:'POST',credentials:'omit',mode:'cors',redirect:'manual',keepalive:true,signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${target!.key}`},body}]) as Response;
    for(const limit of (response.headers.get('X-Sentry-Rate-Limits')??'').split(',')) {
     const [seconds,categories]=limit.trim().split(':'),duration=Number(seconds);
     if((categories===''||categories?.split(';').includes('session'))&&Number.isFinite(duration)&&duration>0)retryUntil=Math.max(retryUntil,Date.now()+Math.min(60,duration)*1000);
    }
    const receipt=await response.json() as any;
    if(!receipt||!['accepted','rejected','dropped'].includes(receipt.outcome))return result('unknown','unexpected_response');
    return result(receipt.outcome,typeof receipt.reason==='string'?receipt.reason:undefined);
    };
    return await Promise.race([work(),new Promise<SessionResult>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(result('unknown','transport_failure'))},5000)})]);
   } catch { return result('unknown','transport_failure'); }
   finally {clearTimeout(timer)}
 };
 const send=():Promise<SessionResult>=>{
  // Keep one in-flight observation and the latest state, even during an offline burst.
  latest=JSON.stringify({sid,started:started/1000,timestamp:Math.max(started,Date.now())/1000,status,errors,...target?.did?{did:target.did}:{},attrs:{release:target?.release,environment:target?.environment},sdk:{name:'spool.javascript',...typeof __SPOOL_SDK_VERSION__==='string'?{version:__SPOOL_SDK_VERSION__}:{}}});
  if(!pending)pending=Promise.resolve().then(async()=>{
   let receipt=result('unknown','not_sent');
   while(latest!==undefined){const body=latest;latest=undefined;receipt=notify(await transmit(body))}
   return receipt;
  }).finally(()=>{pending=undefined});
  return pending;
 };
 const handle:SpoolSession={
  recordError(unhandled=false){if(ended)return final!;errors=Math.min(1000000,errors+1);return unhandled?handle.end(unhandled==='unhandled'?'unhandled':'crashed'):send()},
  end(next:SessionStatus='exited'){if(ended)return final!;ended=true;if(!['exited','crashed','abnormal','unhandled'].includes(next)){final=Promise.resolve(notify(result('rejected','session_invalid')));return final}status=next;return final=send()},
  flush(){return ended?final!:send()},
 };
 // Queue the start before the caller can record an error or end the session.
 void send();return handle;
}
