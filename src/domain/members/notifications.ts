import { AuthError } from '../../modules/operator-auth/index.mjs';
import type { OwnerSession } from '../owner-authority';
import { statement as s } from '../alerts/types';

export async function teamContext(db:D1Database,project:string) {
 return s(db,'SELECT organization,team FROM spool_project_teams WHERE project=?',project).first<{organization:string;team:string}>();
}

export async function memberForSession(db:D1Database,session:OwnerSession) {
 return s(db,"SELECT id,organization FROM spool_members WHERE operator_id=? AND state='active'",session.operator.id).first<{id:string;organization:string}>();
}

// A project maintainer can affect a whole team only while maintaining every
// project in that team. Admin and installation-owner authority still use their
// normal batch fence at commit.
export async function requireTeamWriter(db:D1Database,session:OwnerSession,organization:string,team:string) {
 if(session.operator.role==='owner')return;
 const member=session.membership;
 if(!member||member.organization!==organization||member.role==='billing'||member.role==='read-only')throw new AuthError('Project not found',404);
 if(member.role==='admin')return;
 const missing=await s(db,`SELECT 1 FROM spool_project_teams t WHERE t.organization=? AND t.team=?
  AND NOT EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.project=t.project AND g.member=? AND g.role='maintainer') LIMIT 1`,organization,team,member.id).first();
 if(missing)throw new AuthError('Project not found',404);
}

export function teamWriterGuard(db:D1Database,session:OwnerSession,organization:string,team:string) {
 if(session.operator.role==='owner')return s(db,'SELECT 1');
 const member=session.membership!;
 return s(db,`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(
  SELECT 1 FROM spool_members m WHERE m.id=? AND m.version=? AND m.state='active' AND m.organization=?
   AND (m.role='admin' OR m.role='member' AND NOT EXISTS(
    SELECT 1 FROM spool_project_teams t WHERE t.organization=? AND t.team=? AND NOT EXISTS(
     SELECT 1 FROM spool_project_grants g WHERE g.project=t.project AND g.member=m.id AND g.role='maintainer')))) THEN 1 ELSE 0 END`,member.id,member.version,organization,organization,team);
}

export async function activeTeamRecipient(db:D1Database,organization:string,team:string,member:string) {
 return s(db,`SELECT m.email,m.version FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
  WHERE m.id=? AND m.organization=? AND m.state='active' AND o.status='active'
   AND (o.role='owner' OR m.role='admin' OR m.role IN ('member','read-only') AND EXISTS(
    SELECT 1 FROM spool_project_grants g JOIN spool_project_teams t ON t.project=g.project
     WHERE g.member=m.id AND t.organization=? AND t.team=?))`,member,organization,organization,team).first<{email:string;version:number}>();
}

export async function activeProjectRecipient(db:D1Database,project:string,member:string) {
 return s(db,`SELECT m.email,m.version FROM spool_members m JOIN oa_operators o ON o.id=m.operator_id
   JOIN spool_project_teams t ON t.organization=m.organization AND t.project=?
   WHERE m.id=? AND m.state='active' AND o.status='active' AND (o.role='owner' OR m.role='admin' OR
    m.role='member' AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.project=t.project AND g.member=m.id AND g.role IN ('maintainer','member')))`,project,member).first<{email:string;version:number}>();
}
