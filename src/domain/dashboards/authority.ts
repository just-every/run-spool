import type {OwnerSession} from '../owner-authority';
import {ownerBatch} from '../owner-authority';
import {projectAuthority,projectAuthorityGuards,type ProjectAuthoritySnapshot} from '../members/resolver';
import {auditCommit} from '../audit';
import {fail} from './input';

export type ProjectSnapshot=ProjectAuthoritySnapshot;
export interface ReportingItem {id:string;organization:string|null;kind:'dashboard'|'table'|'report';name:string;author:string|null;revision:number;created:number;updated:number}
export interface StoredWidget {item:string;id:string;project:string;position:number;name:string;config:string;view_id:string|null}
export interface StoredShare {item:string;id:string;kind:'team'|'role';target:string;active:number;created:number}
export interface ItemSnapshot {row:ReportingItem;projects:string[];widgets:StoredWidget[];shares:StoredShare[]}
export const s=(db:D1Database,sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
export const guard=(db:D1Database,sql:string,...args:unknown[])=>s(db,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN ${sql} THEN 1 ELSE 0 END`,...args);

export const currentProjects=projectAuthority;
export const projectGuards=projectAuthorityGuards;
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
