import { file as normalizedFile, normalize, scrub, type Envelope, type Frame } from './privacy.ts';
export interface CaptureOptions { endpoint:string; project:string; ingestKey:string; release:string; build:string; environment:string; debugId?:string; client?:string; breadcrumbs?:string[]|(()=>string[]); onOutcome?:(result:any)=>void; onPreview?:(event:any)=>void;
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
    event=normalize({version:1,eventId,release:options.release,build:options.build,environment:options.environment,type:/^[\w.:-]+$/.test(name)?name:'Error',message:text(read(error,'message')),frames:parsed,breadcrumbs:(Array.isArray(crumbs)?crumbs:[]).filter(crumb=>typeof crumb==='string').slice(-20),...(options.dropped?{dropped:options.dropped}:{}),...(options.client?{client:options.client}:{})});
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
const repeatWindowMs=5000,repeatEntries=256,locationEntries=16_384,evictionChecks=8,locationStackChars=8192,burst=30,refillMs=2000;
export interface Dropped { outcome:'dropped'; reason:'client_cap'|'duplicate'; eventId:'' }
// Where an error happened: its type and top frame's file, function and line, as Spool groups an issue (the message is
// excluded). Store only a fixed-size fingerprint: stacks and frame paths come from the page and can be arbitrarily long.
interface TrackedError { place:string; error:Error; stack:string }
// Overlong stacks are cut at a line boundary before they are split, parsed or retained, so their state stays bounded
// while the error is still identified and sent. Frames come from the first 30 frame lines, which the cut keeps for any
// ordinary stack. A V8 stack carries the message (possibly many lines) before its first "at" line, and the message is
// sent separately, so the cut starts at that line. Without one, a first line too long to keep holds no frame and is skipped.
function boundedStack(stack:string) {
  if(stack.length<=locationStackChars)return stack;
  const frame=stack.search(/^[ \t]*at\s/m);
  let start=Math.max(frame,0);
  if(frame<0){
    const header=stack.indexOf('\n');
    if(header<0)return '';
    if(header>locationStackChars)start=header+1;
  }
  if(stack.length-start<=locationStackChars)return stack.slice(start);
  const cut=stack.lastIndexOf('\n',start+locationStackChars);
  return cut>start?stack.slice(start,cut):'';
}
function location(error:Error):TrackedError|undefined {
  const typeValue=read(error,'name'),messageValue=read(error,'message'),stackValue=read(error,'stack');
  if(typeValue!==undefined&&typeValue!==null&&typeof typeValue!=='string'||messageValue!==undefined&&messageValue!==null&&typeof messageValue!=='string'||stackValue!==undefined&&stackValue!==null&&typeof stackValue!=='string')return undefined;
  const rawType=typeof typeValue==='string'?typeValue.slice(0,100):'',type=/^[\w.:-]+$/.test(rawType)?rawType:'Error';
  const message=typeof messageValue==='string'?messageValue.slice(0,1000):'',stack=boundedStack(typeof stackValue==='string'?stackValue:'');
  const top=frames(stack)[0];
  const place=!top?fingerprint([type,'','','']):fingerprint([type,normalizedFile(top.file),scrub(top.function),String(top.line)]);
  // Apply the same privacy normalization used by the event before keying, so equivalent issue locations share a cap.
  return {place,stack,error:{name:type,message,stack} as Error};
}
interface Spot { tokens:number; at:number; dropped:number; held?:Error; timer?:ReturnType<typeof setTimeout> }
// Four independent 32-bit streams make keys compact without retaining untrusted paths or messages. Each part is
// bounded before hashing, so a huge URL cannot turn one listener event into unbounded key storage or hashing work.
function fingerprint(parts:string[]) {
  let a=0x811c9dc5,b=0x9e3779b9,c=0x85ebca6b,d=0xc2b2ae35;
  const mix=(value:number)=>{a=Math.imul(a^value,0x01000193);b=Math.imul(b^value,0x5bd1e995);c=Math.imul(c^value,0x27d4eb2d);d=Math.imul(d^value,0x165667b1)};
  for(const part of parts){const length=Math.min(part.length,4096);mix(length);for(let i=0;i<length;i++)mix(part.charCodeAt(i));mix(0xffff)}
  const finish=(value:number)=>{value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;value=Math.imul(value,0x846ca68b);value^=value>>>16;return(value>>>0).toString(16).padStart(8,'0')};
  return finish(a)+finish(b)+finish(c)+finish(d);
}
// Held errors are snapshots rather than references to page-owned Error objects. Keep their bounded stack so a delayed
// send keeps the same normalized issue location.
function heldError(tracked:TrackedError):Error|undefined {
  if(!frames(tracked.stack).length)return undefined;
  return tracked.error;
}
// A page error that repeats one captured in the last few seconds (same location and message) is dropped as a duplicate;
// the repeat map is in time order, so pruning stops at the first live entry, and it keeps at most `repeatEntries` keys, oldest first out.
// Each location sends at most `burst` errors at once and then one every `refillMs`; over that, the latest error there is
// held and sent when the location may send again, and the one it replaces is dropped. Every send carries the number of
// errors at its location that were not sent since its last send. The location table is bounded; only a fully refilled
// spot with no held error or unreported drops can be evicted, so churn cannot reset an active location's limit. At
// capacity, unseen locations settle as dropped until a safe spot is available. A page whose own fetch wrapper reports
// Spool's refusals as errors therefore cannot turn one error into a stream of sends, and every drop settles.
function guard(send:(error:Error,dropped:number)=>void,drop:(reason:Dropped['reason'])=>void) {
  const recent=new Map<string,number>(),spots=new Map<string,Spot>();
  const refill=(spot:Spot,now:number)=>{spot.tokens=Math.min(burst,spot.tokens+(now-spot.at)/refillMs);spot.at=now};
  const dispatch=(spot:Spot,error:Error)=>{spot.tokens=Math.max(0,spot.tokens-1);const dropped=spot.dropped;spot.dropped=0;send(error,dropped)};
  const touch=(place:string,spot:Spot)=>{spots.delete(place);spots.set(place,spot)};
  const acquire=(place:string,now:number) => {
    let spot=spots.get(place);
    if(spot){refill(spot,now);touch(place,spot);return spot}
    if(spots.size>=locationEntries){
      let checked=0;
      for(const [oldPlace,oldSpot] of spots){
        if(checked++>=evictionChecks)break;
        refill(oldSpot,now);
        if(oldSpot.tokens>=burst&&!oldSpot.held&&!oldSpot.dropped&&!oldSpot.timer){spots.delete(oldPlace);break}
        touch(oldPlace,oldSpot);
      }
    }
    if(spots.size>=locationEntries)return undefined;
    spot={tokens:burst,at:now,dropped:0};spots.set(place,spot);return spot;
  };
  const countDrop=(spot:Spot)=>{spot.dropped=Math.min(1e9,spot.dropped+1)};
  const release=(place:string,spot:Spot)=>{spot.timer=undefined;const error=spot.held;spot.held=undefined;refill(spot,Date.now());touch(place,spot);if(error)dispatch(spot,error)};
  return {
    take(error:Error) {
      const now=Date.now(),tracked=location(error);
      if(!tracked){drop('client_cap');return}
      const {place,error:captured}=tracked,key=`${place}\n${captured.message}`;
      for(const [seen,at] of recent){if(now-at<repeatWindowMs)break;recent.delete(seen)}
      let spot=spots.get(place);
      if(recent.has(key)){if(spot){refill(spot,now);touch(place,spot);countDrop(spot)}drop('duplicate');return}
      recent.set(key,now);
      if(recent.size>repeatEntries)recent.delete(recent.keys().next().value!);
      spot=acquire(place,now);
      if(!spot){drop('client_cap');return}
      if(!spot.held&&spot.tokens>=1)return dispatch(spot,captured);
      const pending=heldError(tracked);
      if(!pending){countDrop(spot);drop('client_cap');return}
      if(spot.held){countDrop(spot);drop('client_cap')}
      spot.held=pending;
      const ready=spot;spot.timer??=setTimeout(()=>release(place,ready),Math.ceil((1-spot.tokens)*refillMs));
    },
    close() { for(const spot of spots.values()){clearTimeout(spot.timer);spot.timer=undefined;if(spot.held){spot.held=undefined;drop('client_cap')}} spots.clear() },
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
