import { convertSentry } from '../sentry/convert.ts';
import type { Envelope } from '../privacy.ts';
/** Sentry's owner API event detail is a different contract from SDK wire JSON. */
export function apiEvent(value: any): { event: Envelope; received: number; raw: boolean } {
  if(!value || typeof value!=='object' || !Array.isArray(value.entries))throw new Error('Event detail entries required');
  const exceptionEntry=value.entries.find((entry:any)=>entry?.type==='exception');
  const values=exceptionEntry?.data?.values;
  if(!Array.isArray(values)||!values.length)throw new Error('Exception event detail required');
  const exception=values.at(-1),stack=exception.rawStacktrace??exception.stacktrace;
  if(!Array.isArray(stack?.frames))throw new Error('Event detail stack required');
  const frames=stack.frames.map((frame:any)=>({filename:frame.filename,abs_path:frame.absPath,lineno:frame.lineNo,colno:frame.colNo,function:frame.function}));
  const breadcrumbs=value.entries.find((entry:any)=>entry?.type==='breadcrumbs')?.data?.values;
  const environmentTags=Array.isArray(value.tags)?value.tags.filter((tag:any)=>tag?.key==='environment').map((tag:any)=>tag.value):[];
  if(new Set(environmentTags).size>1 || value.environment && environmentTags.some((environment:any)=>environment!==value.environment))throw new Error('Conflicting exported environment');
  const event=convertSentry({event_id:value.eventID,release:typeof value.release==='object'?value.release?.version:value.release,dist:value.dist,environment:value.environment??environmentTags[0],
    exception:{values:[{type:exception.type,value:exception.value,stacktrace:{frames}}]},breadcrumbs});
  const received=Date.parse(value.dateCreated??value.dateReceived);
  if(!Number.isSafeInteger(received)||received<0)throw new Error('Event detail timestamp required');
  return {event,received,raw:!!exception.rawStacktrace};
}
