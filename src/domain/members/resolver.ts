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
 const policy=/^(?:inbound-filters|grouping-rules|identity-policy|recurrence-policy|release-policy|browser-origins|check-in-routes|retention-policy|retention|commits\/sharing|keys\/[^/]+\/loader)(?:\/|$)/.test(tail);
 const operational=/^(?:fixes|reproducers|repairs)(?:\/|$)/.test(tail);
 if (member.role!=='admin' && (operational || policy && role!=='maintainer')) return missing();
 if (!isRead && role!=='admin') {
  if (role==='read-only') return missing();
  const triage=/^(?:issues\/[^/]+(?:\/(?:assignment|priority|suppression|discussion|comments(?:\/[^/]+)?|subscription))?|bulk-triage|review\/views(?:\/[^/]+)?|suspects\/issues\/[^/]+)$/.test(tail);
  const deployment=/^(?:releases|artifacts|artifact-builds\/verify|deployments(?:\/[^/]+\/callbacks)?|keys(?:\/[^/]+)?)$/.test(tail);
  const maintain=role==='maintainer' && /^(?:inbound-filters|grouping-rules|identity-policy|recurrence-policy|release-policy|browser-origins|check-in-routes|retention-policy|retention|commits\/sharing|grouping-proposals|corrections|suppression-policies|alerting|follow-up|keys)(?:\/|$)/.test(tail);
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
