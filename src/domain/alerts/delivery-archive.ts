import {scrubDigest} from './digest-text';
import { scrub } from '../privacy';
import { timezone } from './calendar';
export const deliveryArchiveTables=['alert_provider_events','alert_digest_settings','alert_snoozes','alert_suppressed','alert_scheduled_mail'];
export function deliveryExportRow(table:string,row:any){
 if(table==='alert_digest_settings')return {...row,daily:0,weekly:0,personal_daily:0,personal_weekly:0,quiet_start:null,quiet_end:null};
 if(table==='alert_snoozes'||table==='alert_scheduled_mail')return {...row,historical:1};
 return row;
}
const fields:Record<string,string>={
 alert_provider_events:'event_id,project,delivery_id,type,state,occurred_at,provenance',
 alert_digest_settings:'project,timezone,destination,daily,weekly,personal_daily,personal_weekly,hour,quiet_start,quiet_end,created,updated',
 alert_snoozes:'id,project,scope,target,until,created,resumed_at,historical',
 alert_suppressed:'delivery_id,project,snooze_id,reason,created,released_at',
 alert_scheduled_mail:'id,project,kind,scope,period,body,state,code,created,updated,historical',
};
function require(ok:unknown):asserts ok{if(!ok)throw new Error('Invalid delivery archive')}
const integer=(x:any)=>Number.isSafeInteger(x)&&x>=0;
export function validateDeliveryArchive(data:any){
 const projects=new Set(data.projects.map((p:any)=>p.id)),histories=new Map(data.alert_history.map((h:any)=>[h.id,h]));
 for(const table of deliveryArchiveTables){require(Array.isArray(data[table]));for(const row of data[table]){
  require(Object.keys(row).sort().join()===fields[table].split(',').sort().join()&&projects.has(row.project));
  for(const [key,value] of Object.entries(row)){
   if(['created','updated','until','occurred_at','resumed_at','released_at'].includes(key))require(value===null||integer(value));
   if(typeof value==='string')require(value.length<=32768&&(key==='body'?scrubDigest(value):scrub(value))===value&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value));
  }
  if(table==='alert_provider_events'){
   require((histories.get(row.delivery_id) as any)?.project===row.project&&['processed','delivered','deferred','bounce','dropped','spamreport'].includes(row.type)&&[null,'delivered','deferred','bounced','dropped','complained'].includes(row.state)&&['sendgrid','fixture'].includes(row.provenance));
  }else if(table==='alert_digest_settings'){
   require(timezone(row.timezone)===row.timezone&&['daily','weekly','personal_daily','personal_weekly'].every(k=>row[k]===0)&&integer(row.hour)&&row.hour<24&&row.quiet_start===null&&row.quiet_end===null&&(row.destination===null||typeof row.destination==='string'));
  }else if(table==='alert_snoozes'){
   require(row.historical===1&&row.until>row.created&&['issue','rule','project'].includes(row.scope));
   require(row.scope==='project'?row.target===row.project:data[row.scope==='issue'?'issues':'alert_rules'].some((r:any)=>r.id===row.target&&r.project===row.project));
  }else if(table==='alert_suppressed'){
   require((histories.get(row.delivery_id) as any)?.project===row.project&&['snooze','team_snooze','quiet_hours'].includes(row.reason));
   if(row.reason==='team_snooze')require(row.snooze_id!==null&&(data.spool_team_snoozes??[]).some((z:any)=>z.id===row.snooze_id&&(data.spool_project_teams??[]).some((t:any)=>t.project===row.project&&t.organization===z.organization)));
   else require(row.snooze_id===null||data.alert_snoozes.some((z:any)=>z.id===row.snooze_id&&z.project===row.project));
  }else {
   require(row.historical===1&&['daily','weekly','resumption'].includes(row.kind)&&['personal','project'].includes(row.scope)&&['queued','running','accepted','rejected','blocked','uncertain'].includes(row.state));
  }
 }}
 return Object.fromEntries(Object.entries(data).filter(([table])=>!deliveryArchiveTables.includes(table)));
}
