import { currentReleaseSequenceSql, latestReleaseSql, releaseOrderSql } from './order';

export type ResolutionMode = 'plain' | 'current' | 'next' | 'named';
export interface Resolution { mode:ResolutionMode; release?:string }
export interface ResolutionTarget { name:string; seq:number }
export function resolutionInput(input:any):Resolution {
 const mode=input.resolution??'current';
 if(!['plain','current','next','named'].includes(mode))throw new Error('Resolution must be plain, current, next or named');
 if(mode==='named'&&(typeof input.release!=='string'||!input.release))throw new Error('Choose an existing release');
 if(mode!=='named'&&input.release!==undefined)throw new Error('A release is only allowed for named resolution');
 return {mode,...mode==='named'?{release:input.release}:{}};
}
export async function resolutionTarget(db:D1Database,project:string,resolution:Resolution):Promise<ResolutionTarget|null> {
 if(resolution.mode==='named'){
  const target=await db.prepare('SELECT name,seq FROM releases WHERE project=? AND name=?').bind(project,resolution.release!).first<ResolutionTarget>();
  if(!target)throw new Error('Choose an existing release in this project');
  return target;
 }
 if(resolution.mode==='next')return db.prepare(`SELECT name,seq FROM releases WHERE project=? ORDER BY ${releaseOrderSql('releases','DESC')} LIMIT 1`).bind(project).first<ResolutionTarget>();
 return null;
}
/** Next is the open cut strictly above the latest identity at resolution time.
 * Registration sequence is only an identity, never a surrogate for project order. */
export function resolutionBoundarySql(resolution:Resolution,target:ResolutionTarget|null,issue='i') {
 return resolution.mode==='next'||resolution.mode==='named'?String(target?.seq??0):currentReleaseSequenceSql(issue);
}
export function resolutionTargetFence(db:D1Database,project:string,resolution:Resolution,target:ResolutionTarget|null) {
 if(resolution.mode==='next')return db.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN COALESCE(${latestReleaseSql('?', 'seq')},0)=? THEN 1 ELSE 0 END`).bind(project,target?.seq??0);
 if(resolution.mode==='named')return db.prepare('INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM releases WHERE project=? AND name=? AND seq=?) THEN 1 ELSE 0 END').bind(project,target!.name,target!.seq);
 return null;
}
export function resolutionDescription(resolution:Resolution,target:ResolutionTarget|null) {
 if(resolution.mode==='plain')return 'Resolved issues reopen on the next event, with or without a release.';
 if(resolution.mode==='next')return `Resolves until the first release above ${target?.name??'the empty release history'} under the project ordering rule. Events in that later release reopen the issue.`;
 if(resolution.mode==='named')return `Resolves until ${target!.name}. Events in that release or a later release reopen the issue under the project ordering rule.`;
 return 'Each issue resolves in its current release. A recurrence in a later release under the project ordering rule reopens it.';
}
