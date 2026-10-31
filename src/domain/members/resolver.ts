import { AuthError, type Session } from '../../modules/operator-auth/index.mjs';
import type { Bindings } from '../../auth/bindings';
import { s, type Membership, type ProjectRole, type TeamSession } from './model';

const read = (request: Request) => ['GET','HEAD'].includes(request.method);
const missing = (): never => { throw new AuthError('Project not found',404); };

/** Resolves product authority after native session authentication. The same
 * resolver runs at each independently mounted private door. */
export async function resolveMembership(request: Request, env: Bindings, session: Session): Promise<TeamSession | null> {
 const member = await s(env.DB,"SELECT id,version,role,organization FROM spool_members WHERE operator_id=? AND state='active'",session.operator.id).first<Membership>();
 if (!member) return null;
 const path = new URL(request.url).pathname.replace(/\/$/,'') || '/';
 const result: TeamSession = { ...session, membership: member };
 // Reporting is a neutral session door. Its handlers intersect every item,
 // query and export with memberProjects and independently fence all writes.
 if (path==='/api/reports'||path==='/api/reporting'||path.startsWith('/api/reporting/')) return member.role==='billing' ? missing() : result;
 if (['/','/app','/sign-in','/signin','/projects','/api/projects','/api/organization/me'].includes(path)) {
  if (read(request) || path==='/api/projects' && member.role==='admin') return result;
  return missing();
 }
 if (path==='/api/organization/usage') return member.role==='admin'||member.role==='billing' ? result : missing();
 if (path==='/api/organization'||path.startsWith('/api/organization/')) return member.role==='admin'&&!path.endsWith('/transfer') ? result : missing();
 if (path==='/api/audit'||path.startsWith('/api/audit/')||path==='/api/archive') return member.role==='admin'&&read(request) ? result : missing();
 // Installation custody, erasure, identity-provider configuration and imports
 // remain with the installation owner. Team roles confer no native admin role.
 const match = /^\/(?:api\/)?projects\/([^/]+)(?:\/(.*))?$/.exec(path);
 if (!match || member.role==='billing') return missing();
 let project: string;
 try { project=decodeURIComponent(match[1]); } catch { return missing(); }
 if (!await s(env.DB,'SELECT 1 FROM projects WHERE id=?',project).first()) return missing();
 let role: ProjectRole | 'admin' = 'admin';
 if (member.role!=='admin') {
  const grant=await s(env.DB,`SELECT g.role FROM spool_project_grants g JOIN spool_project_teams t ON t.project=g.project
   WHERE g.member=? AND g.project=? AND t.organization=?`,member.id,project,member.organization).first<{role:ProjectRole}>();
  if (!grant) return missing();
  role=member.role==='read-only'?'read-only':grant.role;
 }
 const tail=match[2]??'', isRead=read(request), document=!path.startsWith('/api/');
 const policy=/^(?:inbound-filters|grouping-rules|identity-policy|end-user-erasure|recurrence-policy|release-policy|browser-origins|check-in-routes|retention-policy|retention|commits\/sharing|keys\/[^/]+\/loader)(?:\/|$)/.test(tail);
 const operational=/^(?:fixes|reproducers|repairs)(?:\/|$)/.test(tail);
 if (member.role!=='admin' && (operational || policy && role!=='maintainer')) return missing();
 if (!isRead && role!=='admin') {
  if (role==='read-only') return missing();
  const triage=/^(?:issues\/[^/]+(?:\/(?:assignment|priority|suppression|discussion|comments(?:\/[^/]+)?|subscription))?|bulk-triage|review\/views(?:\/[^/]+)?|suspects\/issues\/[^/]+)$/.test(tail);
  const deployment=/^(?:releases|artifacts|artifact-builds\/verify|deployments(?:\/[^/]+\/callbacks)?|keys(?:\/[^/]+)?)$/.test(tail);
  const maintain=role==='maintainer' && /^(?:inbound-filters|grouping-rules|identity-policy|end-user-erasure|recurrence-policy|release-policy|browser-origins|check-in-routes|retention-policy|retention|commits\/sharing|grouping-proposals|corrections|suppression-policies|alerting|follow-up|keys)(?:\/|$)/.test(tail);
  if (!triage&&!deployment&&!maintain) return missing();
 }
 if (document && !isRead) return missing();
 return { ...result, membership: { ...member, project, projectRole: role==='admin'?undefined:role } };
}

/** Current project list is a permissioned read, not a client-side filter. */
export async function memberProjects(db: D1Database, session: TeamSession) {
 if (session.operator.role==='owner') return (await s(db,'SELECT *,\'owner\' role FROM projects ORDER BY created').all()).results;
 const member=session.membership!;
 if (member.role==='billing') return [];
 if (member.role==='admin') return (await s(db,"SELECT p.*,'admin' role FROM projects p JOIN spool_project_teams t ON t.project=p.id WHERE t.organization=? ORDER BY p.created",member.organization).all()).results;
 return (await s(db,`SELECT p.*,CASE WHEN ?='read-only' THEN 'read-only' ELSE g.role END role FROM projects p
  JOIN spool_project_grants g ON g.project=p.id JOIN spool_project_teams t ON t.project=p.id
  WHERE g.member=? AND t.organization=? ORDER BY p.created`,member.role,member.id,member.organization).all()).results;
}

// Reporting reads use the same current membership resolver as every project
// door; the exact snapshots also fence writes and in-flight exports.
export interface ProjectAuthoritySnapshot {id:string;created:number;role:string;organization:string|null;team:string|null;grant_role:string|null}
const membershipGuard=(db:D1Database,sql:string,...args:unknown[])=>s(db,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN ${sql} THEN 1 ELSE 0 END`,...args);
export async function projectAuthority(db:D1Database,session:TeamSession):Promise<Map<string,ProjectAuthoritySnapshot>>{
 const available=await memberProjects(db,session),ids=available.map((row:any)=>row.id),membership=session.membership;
 const rows=(await s(db,`SELECT p.id,p.created,t.organization,t.team,g.role grant_role FROM projects p LEFT JOIN spool_project_teams t ON t.project=p.id
  LEFT JOIN spool_project_grants g ON g.project=p.id AND g.member=? WHERE p.id IN (SELECT value FROM json_each(?))${membership?` AND t.organization=?${membership.role==='admin'?'':' AND g.role IS NOT NULL'}`:''}`,
  membership?.id??'',JSON.stringify(ids),...membership?[membership.organization]:[]).all<any>()).results;
 return new Map(rows.map(row=>[row.id,{...row,role:session.operator.role==='owner'?'owner':membership!.role==='admin'?'admin':membership!.role==='read-only'?'read-only':row.grant_role}]));
}
export function projectAuthorityGuards(db:D1Database,session:TeamSession,projects:ProjectAuthoritySnapshot[],writing=false){
 return projects.map(project=>{
  if(writing&&!['owner','admin','maintainer'].includes(project.role))missing();
  return membershipGuard(db,`EXISTS(SELECT 1 FROM projects p WHERE p.id=? AND p.created=?)${session.membership?` AND EXISTS(SELECT 1 FROM spool_project_teams t WHERE t.project=? AND t.organization=? AND t.team=?)${session.membership.role==='admin'?'':` AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.project=? AND g.member=? AND g.role=?)`}`:''}`,
   project.id,project.created,...session.membership?[project.id,session.membership.organization,project.team,...session.membership.role==='admin'?[]:[project.id,session.membership.id,project.grant_role]]:[]);
 });
}
/** IDs must already have been admitted by memberProjects/projectAuthority. */
export async function resolvedProjectTeams(db:D1Database,authorized:string[],team?:string){
 return (await s(db,`SELECT p.id,t.team FROM projects p LEFT JOIN spool_project_teams t ON t.project=p.id WHERE p.id IN (SELECT value FROM json_each(?))${team===undefined?'':' AND t.team=?'} ORDER BY p.id`,JSON.stringify([...new Set(authorized)]),...team===undefined?[]:[team]).all<{id:string;team:string|null}>()).results;
}
export const projectTeamGrantGuard=(db:D1Database,projects:string[],organization:string|null,team:string)=>membershipGuard(db,'EXISTS(SELECT 1 FROM spool_project_teams WHERE organization=? AND team=? AND project IN (SELECT value FROM json_each(?)))',organization,team,JSON.stringify(projects));
export const operatorDisplayName=(db:D1Database,operator:string)=>s(db,'SELECT display_name name FROM oa_operators WHERE id=?',operator).first<{name:string}>();
