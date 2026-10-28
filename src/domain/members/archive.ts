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
export const memberDefaults = (data:any) => ({...Object.fromEntries(Object.keys(memberTables).map(table=>[table,[]])),...data});
export function memberExportRow(table:string,row:any) {
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
export function validateMemberArchive(data:any) {
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
 const scopes=new Set<string>();
 for(const row of data.spool_service_scopes){
  const key=JSON.stringify([row.service,row.project,row.kind]);
  require(services.has(row.service)&&projects.has(row.project)&&teams.get(row.project)===services.get(row.service).organization&&['agent','deploy','ingest'].includes(row.kind)&&!scopes.has(key));scopes.add(key);
 }
}
