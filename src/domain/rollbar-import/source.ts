import type { Json, ParsedRecord } from '../../modules/import-kit/src/types.ts';
import { sourceId, timestamp } from './identity.ts';
import { sourceText } from '../sentry-import/source.ts';
export const importFormat = 'spool-rollbar-export';
export function apiResult(value: any): any {
 if (!value || typeof value !== 'object' || value.err !== 0 || !Object.hasOwn(value,'result') || value.result === null) throw new Error('Successful Rollbar API response required');
 return value.result;
}
/** A bounded collection of exact authorized API responses, never SDK POST payloads. */
export function parseRollbar(value: Json): ParsedRecord[] {
 const bundle = value as any;
 if (!bundle || bundle.format !== importFormat || bundle.version !== 1 || Object.keys(bundle).some(key=>!['format','version','exportedAt','project','collections','unavailable'].includes(key))) throw new Error('Unsupported Rollbar export');
 if (typeof bundle.exportedAt !== 'string' || !Number.isFinite(Date.parse(bundle.exportedAt))) throw new Error('Export time required');
 const project = apiResult(bundle.project), id = sourceId(project.id);
 sourceText(project.name,'Rollbar project name'); timestamp(project.date_created);
 if (!Array.isArray(bundle.collections) || !Array.isArray(bundle.unavailable) || bundle.collections.length > 100 || bundle.unavailable.some((entry:any)=>!entry || typeof entry.kind !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim() || entry.reason.length>500)) throw new Error('Collections and named unavailable data required');
 const records: ParsedRecord[] = [{kind:'manifest',sourceId:id,payload:{vendor:'rollbar',project:id,exportedAt:bundle.exportedAt,unavailable:bundle.unavailable},pointer:''},
  {kind:'projects',sourceId:id,payload:{vendor:'rollbar',project:id,data:project},pointer:'/project/result'}];
 const seen = new Set<string>();
 for (const [ci,collection] of bundle.collections.entries()) {
  if (!collection || Object.keys(collection).some(key=>!['kind','item','channel','pages','complete'].includes(key)) || collection.complete !== true || !Array.isArray(collection.pages) || !collection.pages.length || collection.pages.length > 100) throw new Error('Complete bounded Rollbar collection required');
  const kind = collection.kind;
  if (!['items','occurrences','deploys','item_events','notification_rules','artifacts'].includes(kind)) throw new Error('Unsupported Rollbar collection; name unavailable data');
  const item = kind==='item_events' ? sourceId(collection.item) : null;
  const channel = kind==='notification_rules' ? collection.channel : null;
  if (channel!==null && !['email','slack','pagerduty','webhook'].includes(channel)) throw new Error('Unsupported Rollbar notification channel');
  const key = JSON.stringify([kind,item,channel]); if (seen.has(key)) throw new Error('Duplicate Rollbar collection'); seen.add(key);
  for (const [pi,page] of collection.pages.entries()) {
   if (!page || page.page !== pi+1 || Object.keys(page).some(key=>!['page','response'].includes(key))) throw new Error('Broken Rollbar page sequence');
   const result=apiResult(page.response),pointer=`/collections/${ci}/pages/${pi}/response/result`;
   if (kind==='items' || kind==='deploys') {
    const rows=result[kind];
    if (!Array.isArray(rows) || result.page!==undefined && result.page!==page.page) throw new Error('Rollbar list response required');
    for (const [ri,data] of rows.entries()) {
     if (data.project_id!==undefined && sourceId(data.project_id)!==id) throw new Error('Rollbar record belongs to another project');
     records.push({kind,sourceId:sourceId(data.id),payload:{vendor:'rollbar',project:id,data},pointer:`${pointer}/${kind}/${ri}`});
    }
   } else if (kind==='occurrences') {
    // Each occurrence detail retains its full data, unlike list summaries.
    const occurrence=sourceId(result.id); sourceId(result.item_id);
    if (!result.data || typeof result.data!=='object' || Array.isArray(result.data)) throw new Error('Rollbar occurrence detail required');
    if (result.project_id!==undefined && sourceId(result.project_id)!==id) throw new Error('Rollbar occurrence belongs to another project');
    records.push({kind,sourceId:occurrence,payload:{vendor:'rollbar',project:id,data:result},pointer});
   } else {
    if(kind==='notification_rules' && !Array.isArray(result))throw new Error('Rollbar notification rule array required');
    if(kind==='item_events' && (!Array.isArray(result.events) || result.page!==undefined && result.page!==page.page || result.events.some((event:any)=>event.item_id!==undefined && sourceId(event.item_id)!==item)))throw new Error('Rollbar item event list required');
    // API event and channel rule envelopes remain whole: their provider schema
    // is not an authority to execute or to create local people or destinations.
    records.push({kind,sourceId:JSON.stringify([item??channel??'artifacts',page.page]),payload:{vendor:'rollbar',project:id,item,channel,data:result},pointer});
   }
  }
 }
 for (const kind of ['items','occurrences','deploys']) if (!seen.has(JSON.stringify([kind,null,null]))) throw new Error(`Rollbar ${kind} collection required`);
 for(const record of records.filter(row=>row.kind==='items')) {
  if(!bundle.collections.some((c:any)=>c.kind==='item_events'&&String(c.item)===record.sourceId) && !bundle.unavailable.some((entry:any)=>entry.kind==='item_events'&&String(entry.item)===record.sourceId))throw new Error('Name unavailable history for every Rollbar item');
 }
 for(const channel of ['email','slack','pagerduty','webhook']) {
  if(!bundle.collections.some((c:any)=>c.kind==='notification_rules'&&c.channel===channel) && !bundle.unavailable.some((entry:any)=>entry.kind==='notification_rules'&&entry.channel===channel))throw new Error('Name unavailable Rollbar notification channel');
 }
 for (const kind of ['artifacts','grouping_rules','tracker_links']) {
  if (!bundle.collections.some((c:any)=>c.kind===kind) && !bundle.unavailable.some((entry:any)=>entry.kind===kind)) throw new Error(`Name unavailable Rollbar ${kind}`);
 }
 const rank:Record<string,number>={manifest:0,projects:1,deploys:2,items:3,occurrences:4};
 return records.sort((a,b)=>(rank[a.kind]??5)-(rank[b.kind]??5));
}
