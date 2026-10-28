import type {OwnerSession} from '../owner-authority';
import {ownerBatch} from '../owner-authority';
import {memberProjects} from '../members/resolver';
import {auditCommit} from '../audit';
import {fail} from './input';

export interface ProjectSnapshot {id:string;created:number;role:string;organization:string|null;team:string|null;grant_role:string|null}
export interface ReportingItem {id:string;organization:string|null;kind:'dashboard'|'table'|'report';name:string;author:string|null;revision:number;created:number;updated:number}
export interface StoredWidget {item:string;id:string;project:string;position:number;name:string;config:string;view_id:string|null}
export interface StoredShare {item:string;id:string;kind:'team'|'role';target:string;active:number;created:number}
export interface ItemSnapshot {row:ReportingItem;projects:string[];widgets:StoredWidget[];shares:StoredShare[]}
export const s=(db:D1Database,sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
export const guard=(db:D1Database,sql:string,...args:unknown[])=>s(db,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN ${sql} THEN 1 ELSE 0 END`,...args);

export async function currentProjects(db:D1Database,session:OwnerSession):Promise<Map<string,ProjectSnapshot>>{
 const available=await memberProjects(db,session),ids=available.map((row:any)=>row.id),roles=new Map(available.map((row:any)=>[row.id,row.role]));
 const rows=(await s(db,`SELECT p.id,p.created,t.organization,t.team,g.role grant_role FROM projects p LEFT JOIN spool_project_teams t ON t.project=p.id
  LEFT JOIN spool_project_grants g ON g.project=p.id AND g.member=? WHERE p.id IN (SELECT value FROM json_each(?))`,session.membership?.id??'',JSON.stringify(ids)).all<any>()).results;
 return new Map(rows.map(row=>[row.id,{...row,role:roles.get(row.id)}]));
}
export function projectGuards(db:D1Database,session:OwnerSession,projects:ProjectSnapshot[],writing=false){
 return projects.map(project=>{
  if(writing&&!['owner','admin','maintainer'].includes(project.role))fail('Project not found',404);
  return guard(db,`EXISTS(SELECT 1 FROM projects p WHERE p.id=? AND p.created=?)${session.membership?` AND EXISTS(SELECT 1 FROM spool_project_teams t WHERE t.project=? AND t.organization=? AND t.team=?)${session.membership.role==='admin'?'':` AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.project=? AND g.member=? AND g.role=?)`}`:''}`,
   project.id,project.created,...session.membership?[project.id,project.organization,project.team,...session.membership.role==='admin'?[]:[project.id,session.membership.id,project.grant_role]]:[]);
 });
}
export const itemRevisionGuard=(db:D1Database,item:ReportingItem)=>guard(db,'EXISTS(SELECT 1 FROM spool_reporting_items WHERE id=? AND revision=?)',item.id,item.revision);
export function manager(session:OwnerSession,row:ReportingItem){return session.operator.role==='owner'||session.membership?.role==='admin'&&session.membership.organization===row.organization}
export function canRead(session:OwnerSession,snapshot:ItemSnapshot,projects:Map<string,ProjectSnapshot>){
 const visible=snapshot.projects.filter(id=>projects.has(id));
 if(!visible.length)return false;
 if(manager(session,snapshot.row))return true;
 if(!session.membership||session.membership.organization!==snapshot.row.organization||session.membership.role==='billing')return false;
 if(snapshot.row.author===session.operator.id)return true;
 return snapshot.shares.some(share=>share.active===1&&(share.kind==='role'?share.target===session.membership!.role:visible.some(id=>projects.get(id)?.team===share.target)));
}
export function canEdit(session:OwnerSession,snapshot:ItemSnapshot,projects:Map<string,ProjectSnapshot>){
 return snapshot.projects.length>0&&snapshot.projects.every(id=>projects.has(id)&&['owner','admin','maintainer'].includes(projects.get(id)!.role))&&
  (manager(session,snapshot.row)||session.membership?.organization===snapshot.row.organization&&snapshot.row.author===session.operator.id&&session.membership?.role!=='read-only');
}
export async function loadItem(db:D1Database,id:string):Promise<ItemSnapshot>{
 const results=await db.batch([
  s(db,'SELECT * FROM spool_reporting_items WHERE id=?',id),s(db,'SELECT project FROM spool_reporting_projects WHERE item=? ORDER BY project',id),
  s(db,'SELECT * FROM spool_reporting_widgets WHERE item=? ORDER BY position',id),s(db,'SELECT * FROM spool_reporting_shares WHERE item=? ORDER BY id',id),
 ]);
 const row=results[0].results[0] as unknown as ReportingItem|undefined;
 if(!row)return fail('Reporting item not found',404);
 return {row,projects:results[1].results.map((row:any)=>row.project),widgets:results[2].results as unknown as StoredWidget[],shares:results[3].results as unknown as StoredShare[]};
}
export async function finishRead(db:D1Database,session:OwnerSession,projects:ProjectSnapshot[],items:ReportingItem[]=[]){
 await ownerBatch(db,session,[...projectGuards(db,session,projects),...items.map(item=>itemRevisionGuard(db,item)),auditCommit(db)]);
}
