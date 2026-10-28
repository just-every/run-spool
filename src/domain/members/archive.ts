import { normalizeEmail } from '../../modules/operator-auth/policy.mjs';
import { identity, scrub } from '../privacy';

export const memberTables = {
 spool_organizations: ['id','name','created'],
 spool_members: ['id','organization','operator_id','email','name','role','state','version','created'],
 spool_project_teams: ['project','organization','team'],
 spool_project_grants: ['member','project','role','created'],
 spool_member_invites: ['id','member','created','state'],
 spool_service_accounts: ['id','organization','name','sponsor','state','version','created'],
 spool_service_scopes: ['service','project','kind'],
};
export const teamAlertTables = {
 spool_team_digest_settings: ['organization','team','member','timezone','daily','weekly','hour','created','updated'],
 spool_team_snoozes: ['id','organization','team','scope','target','until','created','creator','resumed_at','historical'],
 spool_team_mail: ['id','organization','team','member','kind','period','body','state','code','created','updated','historical','projects','member_version'],
};
export const memberDefaults = (data:any) => ({...Object.fromEntries(Object.keys({...memberTables,...teamAlertTables}).map(table=>[table,[]])),...data});
export function memberExportRow(table:string,row:any) {
 if(table==='spool_team_digest_settings')return {...row,daily:0,weekly:0};
 if(table==='spool_team_snoozes')return {...row,historical:1};
 if(table==='spool_team_mail')return {...row,body:row.body.split('\n').map((line:string)=>scrub(line)).join('\n'),historical:1,state:'historical',code:'archive_inert'};
 if(table==='spool_members')return {...row,operator_id:null,state:'inert',name:scrub(row.name)};
 if(table==='spool_service_accounts')return {...row,sponsor:'',state:'inert',name:scrub(row.name)};
 if(table==='spool_member_invites')return {...row,state:'inert'};
 if(table==='spool_organizations')return {...row,name:scrub(row.name)};
 if(table==='spool_project_teams')return {...row,team:scrub(row.team)};
 return row;
}
function require(value:unknown):asserts value {if(!value)throw new Error('Invalid membership archive');}
const integer=(value:any)=>Number.isSafeInteger(value)&&value>=0;
const text=(value:any)=>typeof value==='string'&&value.trim().length>0&&value.length<=120&&scrub(value)===value&&!/[\x00-\x1f\x7f]/.test(value);
function indexed(rows:any[],key:string) {
 const found=new Map<string,any>();
 for(const row of rows){identity(row[key],key);require(!found.has(row[key]));found.set(row[key],row);}
 return found;
}
export function validateMemberArchive(data:any,alertRules:any[] = []) {
 const organizations=indexed(data.spool_organizations,'id'),members=indexed(data.spool_members,'id'),services=indexed(data.spool_service_accounts,'id');
 const projects=new Set(data.projects.map((row:any)=>row.id)),teams=new Map<string,string>(),emails=new Set<string>();
 for(const row of organizations.values())require(text(row.name)&&integer(row.created));
 for(const row of members.values()){
  require(organizations.has(row.organization)&&row.operator_id===null&&row.state==='inert'&&['admin','billing','member','read-only'].includes(row.role)&&integer(row.version)&&row.version>0&&integer(row.created)&&text(row.name));
  require(normalizeEmail(row.email)===row.email&&!emails.has(row.email));
  emails.add(row.email);
 }
 for(const row of data.spool_project_teams){require(projects.has(row.project)&&organizations.has(row.organization)&&text(row.team)&&!teams.has(row.project));teams.set(row.project,row.organization);}
 const grants=new Set<string>();
 for(const row of data.spool_project_grants){
  const key=JSON.stringify([row.member,row.project]);
  require(members.has(row.member)&&projects.has(row.project)&&teams.get(row.project)===members.get(row.member).organization&&['maintainer','member','read-only'].includes(row.role)&&integer(row.created)&&!grants.has(key));grants.add(key);
 }
 const invites=indexed(data.spool_member_invites,'id');
 for(const row of invites.values())require(members.has(row.member)&&row.state==='inert'&&integer(row.created));
 for(const row of services.values())require(organizations.has(row.organization)&&text(row.name)&&row.sponsor===''&&row.state==='inert'&&integer(row.version)&&row.version>0&&integer(row.created));
 // Historical team facts remain valid after projects move between teams.
 const teamExists=(organization:string,team:string)=>organizations.has(organization)&&text(team);
 const settingKeys=new Set<string>();
 for(const row of data.spool_team_digest_settings){
  const key=JSON.stringify([row.organization,row.team,row.member]);
  require(teamExists(row.organization,row.team)&&members.get(row.member)?.organization===row.organization&&!settingKeys.has(key));
  settingKeys.add(key);
  require(row.daily===0&&row.weekly===0&&integer(row.hour)&&row.hour<=23&&integer(row.created)&&integer(row.updated));
  require(typeof row.timezone==='string'&&row.timezone.length<=100);
  try{new Intl.DateTimeFormat('en',{timeZone:row.timezone})}catch{require(false)}
 }
 const snoozes=indexed(data.spool_team_snoozes,'id');
 for(const row of snoozes.values()){
  require(teamExists(row.organization,row.team)&&members.get(row.creator)?.organization===row.organization&&row.historical===1&&integer(row.until)&&integer(row.created)&&(row.resumed_at===null||integer(row.resumed_at)));
  require(['team','issue','rule'].includes(row.scope));
  require(row.scope==='team'?row.target===row.team:(row.scope==='issue'?data.issues:alertRules).some((x:any)=>x.id===row.target&&data.spool_project_teams.some((t:any)=>t.project===x.project&&t.organization===row.organization)));
 }
 const mail=indexed(data.spool_team_mail,'id'),mailKeys=new Set<string>();
 for(const row of mail.values()){
  const key=JSON.stringify([row.organization,row.team,row.member,row.kind,row.period]);
  require(teamExists(row.organization,row.team)&&members.get(row.member)?.organization===row.organization&&row.historical===1&&row.state==='historical'&&row.code==='archive_inert'&&!mailKeys.has(key));mailKeys.add(key);
  require(['daily','weekly','resumption'].includes(row.kind)&&typeof row.period==='string'&&row.period.length<=120&&integer(row.created)&&integer(row.updated)&&integer(row.member_version));
  require(typeof row.body==='string'&&row.body.length<=1024*1024&&row.body.split('\n').every((line:string)=>scrub(line)===line));
  let scopes:any;try{scopes=JSON.parse(row.projects)}catch{require(false)}
  require(Array.isArray(scopes)&&scopes.every((p:any)=>projects.has(p)));
 }
 const scopes=new Set<string>();
 for(const row of data.spool_service_scopes){
  const key=JSON.stringify([row.service,row.project,row.kind]);
  require(services.has(row.service)&&projects.has(row.project)&&teams.get(row.project)===services.get(row.service).organization&&['agent','deploy','ingest'].includes(row.kind)&&!scopes.has(key));scopes.add(key);
 }
}
