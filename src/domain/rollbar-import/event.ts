import { convertSentry } from '../sentry/convert.ts';
import { eventId, sourceId, timestamp } from './identity.ts';
/** Rollbar frames run oldest to newest; the native diagnostic view is newest first. */
export function occurrenceEvent(project: string, occurrence: any) {
 const data=occurrence.data,body=data?.body;
 if(typeof data?.environment!=='string'||!data.environment)throw new Error('Rollbar occurrence environment required');
 // pyrollbar reports "python <version>" and omits traceback columns.
 const python=data.language==='python'||typeof data.language==='string'&&data.language.startsWith('python ');
 const chain=body?.trace_chain ?? (body?.trace ? [body.trace] : []);
 if (!Array.isArray(chain) || !chain.length) throw new Error('Rollbar trace or trace_chain required; message and crash-report conversion unavailable');
 const exceptions=chain.map((trace:any)=>{
  if (!trace?.exception || !Array.isArray(trace.frames)) throw new Error('Rollbar exception and frames required');
  return {type:trace.exception.class,value:trace.exception.message,stacktrace:{frames:trace.frames.map((frame:any)=>({
   // Rollbar columns are zero based; the Sentry bridge takes one based columns.
   filename:frame.filename,lineno:frame.lineno,colno:Number.isSafeInteger(frame.colno)&&frame.colno>=0?frame.colno+1:undefined,function:frame.method,
  }))}};
 });
 const breadcrumbs=Array.isArray(data.telemetry) ? data.telemetry.filter((row:any)=>typeof row.body?.message==='string').map((row:any)=>({category:row.type,message:row.body.message})) : [];
 const event=convertSentry({event_id:eventId(project,sourceId(occurrence.id)),
  release:data.code_version,environment:data.environment,
  platform:python?'python':data.language==='go'?'go':undefined,
  exception:{values:exceptions},breadcrumbs});
 return {event,received:timestamp(occurrence.timestamp)};
}
