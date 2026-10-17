import { framePath } from '../frame-path.ts';
import { isObject, evidenceText, evidenceValue, evidenceRecord, frameVariables } from './evidence-values.ts';
import type { SentryEvidence, SentryFrame, SentryStack, SentryException, Truncation } from './evidence-types.ts';
export type { SentryEvidence, SentryFrame, SentryException, Truncation } from './evidence-types.ts';
const textKeys=['filename','abs_path','module','package','function','raw_function','symbol','platform','instruction_addr','symbol_addr','image_addr','addr_mode','trust'] as const;
const finite=(v:any)=>typeof v==='number'&&Number.isFinite(v);
function stack(value:any,path:string,notes:Truncation[]):SentryStack|undefined {
 if(!isObject(value)||!Array.isArray(value.frames))return undefined;
 const all=value.frames.filter(isObject);
 if(all.length!==value.frames.length)notes.push({path:`${path}.frames`,reason:'invalid_frames',omitted:value.frames.length-all.length});
 const omitted=Math.max(0,all.length-1000);
 const selected=omitted?[...all.slice(0,500),...all.slice(-500)]:all;
 if(omitted)notes.push({path:`${path}.frames`,reason:'middle_frames',omitted});
 const frames=selected.map((raw,index)=>{
  const f:SentryFrame={},p=`${path}.frames.${index}`;
  for(const key of textKeys)if(typeof raw[key]==='string')f[key]=key==='filename'||key==='abs_path'?framePath(raw[key],'python'):evidenceText(raw[key],`${p}.${key}`,notes);
  for(const key of ['lineno','colno'] as const)if(Number.isSafeInteger(raw[key])&&raw[key]>=0)f[key]=raw[key];
  if(typeof raw.in_app==='boolean')f.in_app=raw.in_app;
  for(const key of ['pre_context','post_context'] as const)if(Array.isArray(raw[key]))f[key]=raw[key].filter((line:any)=>typeof line==='string').map((line:string,i:number)=>evidenceText(line,`${p}.${key}.${i}`,notes));
  if(typeof raw.context_line==='string')f.context_line=evidenceText(raw.context_line,`${p}.context_line`,notes);
  const vars=frameVariables(raw.vars,`${p}.vars`,notes);if(vars)f.vars=vars;
  return f;
 });
 const sdkOmitted=Array.isArray(value.frames_omitted)&&value.frames_omitted.every(finite)?value.frames_omitted:undefined;
 return {frames,...(omitted?{frames_omitted:[500,500+omitted]}:sdkOmitted?{frames_omitted:sdkOmitted}:{})};
}
function exception(value:any,index:number,notes:Truncation[]):SentryException {
 const e:SentryException={},path=`exceptions.${index}`;
 for(const key of ['type','value','module'] as const)if(typeof value[key]==='string')e[key]=evidenceText(value[key],`${path}.${key}`,notes);
 if(isObject(value.mechanism)){
  e.mechanism={};
  for(const key of ['type','source'] as const)if(typeof value.mechanism[key]==='string')e.mechanism[key]=evidenceText(value.mechanism[key],`${path}.mechanism.${key}`,notes);
  for(const key of ['handled','synthetic','is_exception_group'] as const)if(typeof value.mechanism[key]==='boolean')e.mechanism[key]=value.mechanism[key];
  for(const key of ['exception_id','parent_id'] as const)if(Number.isSafeInteger(value.mechanism[key]))e.mechanism[key]=value.mechanism[key];
 }
 const s=stack(value.stacktrace,`${path}.stacktrace`,notes);if(s)e.stacktrace=s;
 return e;
}
function tags(value:any,notes:Truncation[]):Record<string,string>{
 const entries=Array.isArray(value)?value.filter(v=>Array.isArray(v)&&v.length===2):isObject(value)?Object.entries(value):[];
 return Object.fromEntries(entries.filter(([key,v])=>typeof key==='string'&&['string','boolean','number'].includes(typeof v)).map(([key,v])=>{
  const record=evidenceRecord({[key]:String(v)},'tags',notes)!;
  return Object.entries(record)[0] as [string,string];
 }));
}
/** Shared sanitizer for admission, stored owner reads and private archive export. */
export function sanitizeSentry(value:any):SentryEvidence {
 if(!isObject(value)||value.version!==1||!Array.isArray(value.exceptions))throw new Error('Invalid Sentry evidence');
 const notes:Truncation[]=Array.isArray(value.truncation)?value.truncation.filter(isObject).filter(n=>typeof n.path==='string'&&typeof n.reason==='string').map(n=>({path:evidenceText(n.path,'truncation.path',[]),reason:evidenceText(n.reason,'truncation.reason',[]),...(Number.isSafeInteger(n.omitted)&&n.omitted>=0?{omitted:n.omitted}:{})})):[];
 if(value.user!==undefined)notes.push({path:'user',reason:'identity_policy_unavailable'});
 const out:SentryEvidence={version:1,exceptions:value.exceptions.filter(isObject).map((e,i)=>exception(e,i,notes)),truncation:notes};
 for(const key of ['platform','level','logger','transaction','server_name','environment','release','dist','message'] as const)if(typeof value[key]==='string')out[key]=evidenceText(value[key],key,notes);
 for(const key of ['modules','sdk','debug_meta','contexts','extra','_meta'] as const){const r=evidenceRecord(value[key],key,notes);if(r)out[key]=r;}
 if(Array.isArray(value.fingerprint))out.fingerprint=value.fingerprint.filter((v:any)=>typeof v==='string').map((v:string,i:number)=>evidenceText(v,`fingerprint.${i}`,notes));
 if(isObject(value.logentry)){
  out.logentry={};
  for(const key of ['message','formatted'] as const)if(typeof value.logentry[key]==='string')out.logentry[key]=evidenceText(value.logentry[key],`logentry.${key}`,notes);
  if(value.logentry.params!==undefined)out.logentry.params=evidenceValue(value.logentry.params,'logentry.params',notes);
 }
 const standalone=stack(value.stacktrace,'stacktrace',notes);if(standalone)out.stacktrace=standalone;
 if(Array.isArray(value.threads))out.threads=value.threads.filter(isObject).map((thread,index)=>{
  const result:NonNullable<SentryEvidence['threads']>[number]={},path=`threads.${index}`;
  if(typeof thread.name==='string')result.name=evidenceText(thread.name,`${path}.name`,notes);
  for(const key of ['id','state'] as const)if(thread[key]!==undefined)result[key]=evidenceValue(thread[key],`${path}.${key}`,notes);
  for(const key of ['crashed','current'] as const)if(typeof thread[key]==='boolean')result[key]=thread[key];
  const s=stack(thread.stacktrace,`${path}.stacktrace`,notes);if(s)result.stacktrace=s;
  return result;
 });
 if(Array.isArray(value.breadcrumbs))out.breadcrumbs=value.breadcrumbs.filter(isObject).map((crumb,index)=>{
  const kept=Object.fromEntries(Object.entries(crumb).filter(([key])=>['type','category','level','timestamp','message','data'].includes(key)));
  return evidenceRecord(kept,`breadcrumbs.${index}`,notes)!;
 });
 if(isObject(value.request)){
  const r=value.request,kept:Record<string,any>={};
  for(const key of ['url','method'] as const)if(typeof r[key]==='string')kept[key]=r[key];
  if(r.headers!==undefined){const headers=Array.isArray(r.headers)?Object.fromEntries(r.headers.filter((v:any)=>Array.isArray(v)&&v.length===2)):r.headers;if(isObject(headers))kept.headers=headers;}
  if(isObject(r.env)){
   const allowed=['SERVER_NAME','SERVER_PORT','SERVER_PROTOCOL','REQUEST_METHOD','HTTP_HOST'];
   kept.env=Object.fromEntries(Object.entries(r.env).filter(([key])=>allowed.includes(key)));
   if(Object.keys(kept.env).length!==Object.keys(r.env).length)notes.push({path:'request.env',reason:'request_policy_excluded'});
  }
  out.request=evidenceRecord(kept,'request',notes);
  for(const key of ['cookies','data','query_string'])if(r[key]!==undefined)notes.push({path:`request.${key}`,reason:'request_policy_excluded'});
 }
 if(Array.isArray(out.debug_meta?.images))out.debug_meta.images=out.debug_meta.images.map(image=>{
  if(!isObject(image))return image;
  return Object.fromEntries(Object.entries(image).map(([key,v])=>[key,(key==='code_file'||key==='debug_file')&&typeof v==='string'?framePath(v,'python'):v]));
 });
 out.tags=tags(value.tags,notes);
 const derived:Record<string,any>={level:out.level,environment:out.environment,release:out.release,dist:out.dist,transaction:out.transaction,server_name:out.server_name,url:out.request?.url};
 const title=out.exceptions.at(-1),mechanism=title?.mechanism;
 if(mechanism?.handled!==undefined)derived.handled=String(mechanism.handled);
 if(mechanism?.type)derived.mechanism=mechanism.type;
 for(const key of ['browser','os','device','runtime']){
  const context=out.contexts?.[key];
  if(isObject(context)){
   const fields=context as Record<string,any>;
   const name=key==='device'?fields.family??fields.name:fields.name;
   if(typeof name==='string'){derived[key]=name;derived[`${key}.${key==='device'?'family':'name'}`]=name;}
  }
 }
 for(const [key,v] of Object.entries(derived))if(typeof v==='string')out.tags[key]=v;
 // Reading an already bounded record must not invent duplicate trimming remarks.
 out.truncation=Array.from(new Map(notes.map(n=>[JSON.stringify(n),n])).values());
 return out;
}
