import { normalize, type Envelope, type Frame } from './privacy.ts';
export interface CaptureOptions { endpoint:string; project:string; ingestKey:string; release:string; build:string; environment:string; debugId?:string; breadcrumbs?:string[]|(()=>string[]); onOutcome?:(result:any)=>void; onPreview?:(event:any)=>void;
  /** Only Spool's own pages send to their own origin with 'same-origin', so a local dev session's key gate applies. */
  credentials?:'omit'|'same-origin';
  /** The fetch captured when capture was set up, so a fetch wrapper the page installs later never sees Spool's own requests.
   * Present but undefined (no fetch at setup) settles every send as transport_failure. */
  transport?:typeof fetch;
  /** Errors at this error's location that the page listener did not send since its last send there. */
  dropped?:number }
// V8 frames start with "at"; Firefox and Safari frames are "function@file:line:column" with no header line.
export function frames(stack:string,debugId?:string):Frame[] {
  const result:Frame[]=[],lines=stack.split('\n'),v8=lines.some(line=>/^\s*at\s/.test(line));
  for(const line of (v8?lines.filter(line=>/^\s*at\s/.test(line)):lines).slice(0,30)){
    const m=v8?line.match(/^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/):line.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
    // Positions Spool would refuse are skipped, so one odd frame cannot cost the whole event.
    if(!m)continue;
    const row=Number(m[3]),column=Math.max(0,Number(m[4])-1);
    if(row>=1&&row<=1e7&&column<=1e7)result.push({function:m[1]||'<anonymous>',file:m[2],line:row,column,...(debugId?{debugId}:{})});
  }
  return result;
}
// Bundles processed by Spool's source-map tools register their debug ID under the stack of the registration.
function registeredDebugIds() {
  const registry=(globalThis as any)._sentryDebugIds,ids=new Map<string,string>();
  if(registry&&typeof registry==='object')for(const [stack,id] of Object.entries(registry)){const file=frames(stack)[0]?.file;if(file&&typeof id==='string')ids.set(file,id)}
  return ids;
}
function stackFrames(stack:string,debugId?:string) {
  if(debugId)return frames(stack,debugId);
  const ids=registeredDebugIds();
  return frames(stack).map(frame=>ids.has(frame.file)?{...frame,debugId:ids.get(frame.file)}:frame);
}
// randomUUID exists only in secure contexts; getRandomValues exists on every page, in Workers and in Node.
function eventIdentifier() {
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;
  const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
// Hosts throw anything: a field that is missing, of another type or behind a throwing getter reads as empty.
function read(value:unknown,key:'name'|'message'|'stack'):unknown { try { return (value as any)[key] } catch { return undefined } }
function text(value:unknown):string { try { return typeof value==='string'?value:value==null?'':String(value) } catch { return '' } }
// The host's onOutcome callback may throw; that must not turn a capture into a rejection.
export function settle<T>(result:T,onOutcome?:(result:T)=>void):T { try { onOutcome?.(result) } catch {} return result }
// Settles for any thrown value in any environment and never rejects: the promise is the durable outcome boundary.
// Worker callers MUST await it or pass it to waitUntil.
export async function captureException(error:unknown,options:CaptureOptions,eventId?:string) {
  let event:Envelope;
  try {
    eventId??=eventIdentifier();
    const stack=read(error,'stack'),parsed=stackFrames(typeof stack==='string'?stack:'',options.debugId);
    if(!parsed.length)return settle({outcome:'rejected',reason:'no_parseable_stack',eventId},options.onOutcome);
    const name=text(read(error,'name')).slice(0,100),crumbs=typeof options.breadcrumbs==='function'?options.breadcrumbs():options.breadcrumbs;
    event=normalize({version:1,eventId,release:options.release,build:options.build,environment:options.environment,type:/^[\w.:-]+$/.test(name)?name:'Error',message:text(read(error,'message')),frames:parsed,breadcrumbs:(Array.isArray(crumbs)?crumbs:[]).filter(crumb=>typeof crumb==='string').slice(-20),...(options.dropped?{dropped:options.dropped}:{})});
    options.onPreview?.(event);
  }catch {return settle({outcome:'rejected',reason:'invalid_event',eventId:eventId??''},options.onOutcome)}
  try {
    const response=await Reflect.apply('transport' in options?options.transport!:fetch,globalThis,[`${options.endpoint}/api/ingest/${encodeURIComponent(options.project)}`,{method:'POST',credentials:options.credentials??'omit',mode:'cors',redirect:'manual',headers:{'Content-Type':'application/json',Authorization:`Bearer ${options.ingestKey}`},body:JSON.stringify(event),keepalive:true}]) as Response;
    if(response.status===0||(response.status>=300&&response.status<400))throw new Error('Capture redirect refused');
    const body=await response.json() as any;
    return settle(body&&typeof body==='object'&&typeof body.outcome==='string'?{...body,eventId}:{outcome:'unknown',reason:'unexpected_response',status:response.status,eventId},options.onOutcome);
  }catch {return settle({outcome:'unknown',reason:'transport_failure',eventId},options.onOutcome)}
}
// The fetch present now; reading it can throw on a hostile global, and then the send settles as transport_failure.
export function currentFetch():typeof fetch|undefined { try { const value=globalThis.fetch; return typeof value==='function'?value:undefined } catch { return undefined } }
const repeatWindowMs=5000,repeatEntries=256,burst=30,refillMs=2000;
export interface Dropped { outcome:'dropped'; reason:'client_cap'|'duplicate'; eventId:'' }
// Where an error happened: its type and top frame's file, function and line, as Spool groups an issue (the message is
// excluded), so a cap per location never lets one hot location starve another, and its loss count reaches its issue.
function location(error:Error) {
  const name=text(read(error,'name')).slice(0,100),top=frames(text(read(error,'stack')))[0];
  return `${/^[\w.:-]+$/.test(name)?name:'Error'}\n${top?`${top.file}\n${top.function}\n${top.line}`:''}`;
}
interface Spot { tokens:number; at:number; dropped:number; held?:Error; timer?:ReturnType<typeof setTimeout> }
// A page error that repeats one captured in the last few seconds (same location and message) is dropped as a duplicate;
// the repeat map is in time order, so pruning stops at the first live entry, and it keeps at most `repeatEntries` keys, oldest first out.
// Each location sends at most `burst` errors at once and then one every `refillMs`; over that, the latest error there is
// held and sent when the location may send again, and the one it replaces is dropped. Every send carries the number of
// errors at its location that were not sent since its last send. A page whose own fetch wrapper reports Spool's refusals
// as errors therefore cannot turn one error into a stream of sends, and every drop settles and is counted.
function guard(send:(error:Error,dropped:number)=>void,drop:(reason:Dropped['reason'])=>void) {
  const recent=new Map<string,number>(),spots=new Map<string,Spot>();
  const refill=(spot:Spot,now:number)=>{spot.tokens=Math.min(burst,spot.tokens+(now-spot.at)/refillMs);spot.at=now};
  const dispatch=(spot:Spot,error:Error)=>{spot.tokens=Math.max(0,spot.tokens-1);const dropped=spot.dropped;spot.dropped=0;send(error,dropped)};
  const release=(spot:Spot)=>{spot.timer=undefined;const error=spot.held;spot.held=undefined;refill(spot,Date.now());if(error)dispatch(spot,error)};
  return {
    take(error:Error) {
      const now=Date.now(),place=location(error),key=`${place}\n${text(read(error,'message')).slice(0,1000)}`;
      for(const [seen,at] of recent){if(now-at<repeatWindowMs)break;recent.delete(seen)}
      for(const [seen,spot] of spots){refill(spot,now);if(spot.tokens>=burst&&!spot.held&&!spot.dropped)spots.delete(seen)}
      let spot=spots.get(place);
      if(!spot)spots.set(place,spot={tokens:burst,at:now,dropped:0});
      if(recent.has(key)){spot.dropped++;drop('duplicate');return}
      recent.set(key,now);
      if(recent.size>repeatEntries)recent.delete(recent.keys().next().value!);
      if(!spot.held&&spot.tokens>=1)return dispatch(spot,error);
      if(spot.held){spot.dropped++;drop('client_cap')}
      spot.held=error;
      const ready=spot;spot.timer??=setTimeout(()=>release(ready),Math.ceil((1-spot.tokens)*refillMs));
    },
    close() { for(const spot of spots.values()){clearTimeout(spot.timer);if(spot.held){spot.held=undefined;drop('client_cap')}} spots.clear() },
  };
}
// The page listeners cannot throw or reject, so they never feed an error of their own back into themselves.
export function listen(capture:(error:Error,dropped:number)=>unknown,drop:(result:Dropped)=>unknown) {
  const target=(globalThis as any).window as EventTarget|undefined;
  if(typeof target?.addEventListener!=='function')return ()=>{};
  const admit=guard((error,dropped)=>{try{void capture(error,dropped)}catch{}},reason=>{try{drop({outcome:'dropped',reason,eventId:''})}catch{}});
  const take=(value:unknown)=>{try{if(value instanceof Error)admit.take(value)}catch{}};
  const onError=(event:Event)=>take((event as ErrorEvent).error),onRejection=(event:Event)=>take((event as PromiseRejectionEvent).reason);
  target.addEventListener('error',onError);target.addEventListener('unhandledrejection',onRejection);
  return ()=>{target.removeEventListener('error',onError);target.removeEventListener('unhandledrejection',onRejection);admit.close()};
}
export function installBrowserCapture(options:CaptureOptions) { const sending={...options,transport:currentFetch()}; return listen((error,dropped)=>captureException(error,dropped?{...sending,dropped}:sending),result=>settle(result,options.onOutcome)) }
