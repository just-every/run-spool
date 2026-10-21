import {deliveryArchiveTables,deliveryExportRow,validateDeliveryArchive} from './delivery-archive';
import {storedBuild} from '../releases/build';
import { scrub } from '../privacy';
import { issueLink, publicOrigin } from './payload';
import { isShortId } from '../short-ids/format';
export const alertArchiveTables=['alert_rules','alert_history',...deliveryArchiveTables];
export const alertExcludedTables=['alert_destination_tests','rer_mail_event_receipts','rer_mail_event_states','alert_destinations','alert_scheduler','alert_expansion_cursors','alert_intents','alert_cursors','alert_mail_jobs','alert_mail_attempts','integration_%'];
export function alertExportRow(table:string,row:any) {
 if(table==='alert_rules')return {...row,enabled:0};
 if(table==='alert_history')return {...row,historical:1};
 return deliveryExportRow(table,row);
}
const kinds=['new_issue','regression','spike'];
function assert(ok:unknown):asserts ok {if(!ok)throw new Error('Invalid alert archive');}
function shape(row:any,fields:string[]){assert(row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).sort().join()===fields.sort().join());}
function integer(value:any,min=0){assert(Number.isSafeInteger(value)&&value>=min);}
function label(value:any){assert(typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/.test(value));}
function safe(value:any,max=1000){assert(typeof value==='string'&&value.length<=max&&scrub(value)===value);}
export function validateAlertArchive(data:any) {
 validateDeliveryArchive(data);
 const projects=new Set(data.projects.map((r:any)=>r.id)),issues=new Map<string,any>(data.issues.map((r:any)=>[r.id,r])),rules=new Map<string,any>(),alerts=new Map<string,any>();
 assert(Array.isArray(data.alert_rules)&&Array.isArray(data.alert_history));
 for(const r of data.alert_rules){
  shape(r,['id','project','revision','name','enabled','channel','destination','kinds','window_ms','threshold','created','updated']);
  label(r.id);label(r.destination);safe(r.name,100);assert(projects.has(r.project)&&!rules.has(r.id)&&r.enabled===0&&['mail','webhook'].includes(r.channel));
  integer(r.revision,1);integer(r.created);integer(r.updated);integer(r.window_ms,60000);assert(r.window_ms<=86400000&&r.window_ms%60000===0);integer(r.threshold,2);assert(r.threshold<=10000);
  const events=JSON.parse(r.kinds);assert(Array.isArray(events)&&events.length>0&&events.length<=3&&new Set(events).size===events.length&&events.every(k=>kinds.includes(k)));rules.set(r.id,r);
 }
 for(const p of projects)assert(data.alert_rules.filter((r:any)=>r.project===p).length<=20);
 for(const a of data.alerts){
  shape(a,['id','project','issue','kind','created','payload']);label(a.id);integer(a.created);assert(projects.has(a.project)&&issues.get(a.issue)?.project===a.project&&kinds.includes(a.kind)&&!alerts.has(a.id));alerts.set(a.id,a);
  if(a.payload===null){assert(a.kind!=='spike');continue;}
  assert(typeof a.payload==='string'&&a.payload.length<8192);const p=JSON.parse(a.payload);
  // TEAM-004 alerts name the issue's short ID and, after a commit resolution, its commit.
  shape(p,['schema','alertId','kind','projectId','issueId','occurredAt','title','release','issueUrl',...['shortId','resolution'].filter(key=>Object.hasOwn(p,key)),...(a.kind==='spike'?['window','rule']:[])]);
  assert(p.shortId===undefined||p.shortId===null||isShortId(p.shortId)&&p.shortId===p.shortId.toUpperCase());
  if(p.resolution!==undefined&&p.resolution!==null){const r=p.resolution;shape(r,['release','commit','pr',...('citation' in r?['citation']:[]),...('author' in r?['author','message']:[])]);assert(a.kind==='regression'&&typeof r.release==='string'&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(r.commit)&&r.pr===null);
   if('citation' in r){safe(r.citation,200);assert(/^(?:fixes|resolves|closes):?[ \t]+\S+$/i.test(r.citation))}
   if('author' in r){shape(r.author,['name','email']);assert([r.author.name,r.author.email,r.message].every(v=>v===null||typeof v==='string'&&v.length<=1000))}}
  assert(p.schema==='spool.alert.v1'&&p.alertId===a.id&&p.kind===a.kind&&p.projectId===a.project&&p.issueId===a.issue&&p.occurredAt===new Date(a.created).toISOString());safe(p.title);
  if(p.issueUrl!==null){assert(typeof p.issueUrl==='string');const origin=publicOrigin(new URL(p.issueUrl).origin);
   // Existing archives retain the original alert bytes, including pre-canonical links.
   const previous=origin?`${origin}/?project=${encodeURIComponent(a.project)}&issue=${encodeURIComponent(a.issue)}`:null;
   assert(origin&&(p.issueUrl===issueLink(origin,a.project,a.issue)||p.issueUrl===previous));}
  if(a.kind==='spike'){
   assert(p.release===null);shape(p.window,['start','end','durationMs','count','threshold']);shape(p.rule,['id','revision']);
   const r=rules.get(p.rule.id);assert(r?.project===a.project);integer(p.rule.revision,1);assert(p.rule.revision<=r.revision);
   integer(p.window.durationMs,60000);assert(p.window.durationMs<=86400000&&p.window.durationMs%60000===0);integer(p.window.threshold,2);integer(p.window.count,p.window.threshold);assert(p.window.count<=10000);
   const start=Date.parse(p.window.start),end=Date.parse(p.window.end);integer(start);assert(start%p.window.durationMs===0&&end-start===p.window.durationMs&&end===a.created&&new Date(start).toISOString()===p.window.start&&new Date(end).toISOString()===p.window.end);
  } else {shape(p.release,['name','build','sequence']);assert(p.release.name===''?p.release.sequence===0&&storedBuild(p.release.build)===p.release.build:data.releases.some((r:any)=>r.project===a.project&&r.name===p.release.name&&(r.build===p.release.build||(data.release_builds??[]).some((b:any)=>b.project===a.project&&b.release===r.name&&b.build===p.release.build))&&r.seq===p.release.sequence));}
 }
 const histories=new Set();
 for(const h of data.alert_history){
  shape(h,['id','project','alert_id','rule_id','rule_revision','channel','destination','state','code','attempts','created','updated','historical']);label(h.id);label(h.destination);integer(h.rule_revision,1);integer(h.attempts);integer(h.created);integer(h.updated);
  assert(!histories.has(h.id)&&h.historical===1&&alerts.get(h.alert_id)?.project===h.project&&rules.get(h.rule_id)?.project===h.project&&h.rule_revision<=rules.get(h.rule_id).revision&&['mail','webhook'].includes(h.channel));histories.add(h.id);
  assert(['pending','queued','sending','accepted','rejected','retrying','uncertain','blocked','cancelled','captured_locally','snoozed'].includes(h.state));assert(h.code===null||typeof h.code==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(h.code));
  assert(h.id===`${h.alert_id}.${h.rule_id}.${h.rule_revision}`);
 }
 const auditFields:Record<string,string[]>={alert_rule_created:['rule','revision'],alert_rule_revised:['rule','revision'],alert_history_unavailable:['rule','revision','from','cutoff'],alert_delivery_resolved:['delivery','state','evidence']};
 for(const row of data.audit.filter((r:any)=>r.kind.startsWith('alert_'))){
  assert(auditFields[row.kind]&&projects.has(row.project));integer(row.created);const detail=JSON.parse(row.detail);shape(detail,auditFields[row.kind]);
  if(detail.rule){assert(rules.get(detail.rule)?.project===row.project);integer(detail.revision,1);assert(detail.revision<=rules.get(detail.rule).revision)}
  if(row.kind==='alert_history_unavailable'){integer(detail.from);integer(detail.cutoff);assert(detail.from<detail.cutoff)}
  if(row.kind==='alert_delivery_resolved'){assert(data.alert_history.some((h:any)=>h.id===detail.delivery&&h.project===row.project));assert(['accepted','rejected'].includes(detail.state)&&/^[a-z][a-z0-9_]{0,63}$/.test(detail.evidence));}
 }
 // Delegate the unchanged legacy rows to Spool's strict v1/v2 validator. Alert-specific
 // fields and new audit kinds were checked above, never accepted by the legacy reader.
 return {...Object.fromEntries(Object.entries(data).filter(([name])=>!alertArchiveTables.includes(name))),
  alerts:data.alerts.filter((a:any)=>a.kind!=='spike').map(({payload,...row}:any)=>row),
  audit:data.audit.filter((r:any)=>!r.kind.startsWith('alert_'))};
}
