import { normalize, type Envelope, type Frame } from '../privacy.ts';
import { sanitizeSentry } from './evidence';
import { SentryWireError, type WireObject } from './wire.ts';
/** Missing dist has a fixed, explicitly registered identity; it never means latest. */
export const absentDist = 'sentry-no-dist';
/** The first thirty located frames remain the bounded source-map diagnostic view. */
export function convertSentry(value: WireObject, envelopeId?: unknown): Envelope {
 if(value.type!==undefined&&value.type!=='error')throw new SentryWireError('unsupported_event_type',422);
 const language=['python','go'].includes(value.platform)?value.platform:undefined;
 const eventId=value.event_id??envelopeId;
 if(typeof eventId!=='string'||!/^[a-fA-F0-9]{32}$/.test(eventId)||(envelopeId!==undefined&&envelopeId!==eventId))throw new SentryWireError('invalid_event_id');
 if(typeof value.release!=='string'||!value.release)throw new SentryWireError('missing_release_register_required',422);
 const exceptions=Array.isArray(value.exception?.values)?value.exception.values:[];
 const crumbs=Array.isArray(value.breadcrumbs)?value.breadcrumbs:value.breadcrumbs?.values;
 const sentry=sanitizeSentry({...value,version:1,environment:value.environment??'production',level:value.level??(exceptions.length?'error':'info'),exceptions,threads:Array.isArray(value.threads)?value.threads:value.threads?.values,breadcrumbs:Array.isArray(crumbs)?crumbs:[],truncation:[]});
 const exception=sentry.exceptions.at(-1);
 const stack=exception?.stacktrace??sentry.stacktrace??[...sentry.exceptions].reverse().find(e=>e.stacktrace)?.stacktrace;
 const images=Array.isArray(sentry.debug_meta?.images)?sentry.debug_meta.images:[];
 const frames:Frame[]=[];
 for(const frame of [...stack?.frames??[]].reverse()){
  const path=frame.abs_path??frame.filename;
  if(typeof path!=='string'||!Number.isSafeInteger(frame.lineno)||frame.lineno!<1||frame.lineno!>1e7||(!language&&(!Number.isSafeInteger(frame.colno)||frame.colno!<1||frame.colno!>1e7)))continue;
  const matches=images.filter((image:any)=>image?.type==='sourcemap'&&image.code_file===path) as any[];
  if(new Set(matches.map(image=>image.debug_id)).size>1)throw new SentryWireError('conflicting_debug_ids');
  const debugId=matches[0]?.debug_id;
  frames.push({file:path,line:frame.lineno!,column:frame.colno==null?null:frame.colno-1,function:frame.function??'<anonymous>',...(typeof debugId==='string'?{debugId}:{})});
  if(frames.length===30)break;
 }
 const breadcrumbs=(sentry.breadcrumbs??[]).filter(crumb=>typeof crumb.message==='string').slice(-20).map(crumb=>`${typeof crumb.category==='string'?crumb.category.slice(0,100)+': ':''}${crumb.message}`);
 return normalize({version:1,...(language?{language}:{}),eventId:eventId.toLowerCase(),release:value.release,build:value.dist??absentDist,environment:value.environment??'production',type:exception?.type??(exceptions.length?'Error':'Message'),message:exception?.value??sentry.logentry?.formatted??sentry.message??sentry.logentry?.message??'',frames,breadcrumbs,sentry});
}
