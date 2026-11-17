import { scrub } from '../privacy';
import { s } from './common';

// Assignment reuses the existing bounded responsibility field and the product's
// erasable person aliases. Member assignments store an alias, not a name or account ID.
export const projectAssigneesSql = `SELECT o.id,o.display_name name FROM oa_operators o
 WHERE o.status='active' AND (o.role='owner' OR EXISTS(
 SELECT 1 FROM spool_members m JOIN spool_project_teams t ON t.organization=m.organization
 WHERE m.operator_id=o.id AND m.state='active' AND t.project=? AND
 (m.role='admin' OR m.role IN ('member','read-only') AND EXISTS(
 SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=t.project))))`;
export async function projectAssignees(db:D1Database, project:string) {
 const rows=(await s(db,projectAssigneesSql,project).all<{id:string;name:string}>()).results;
 return rows.map(row=>({id:row.id,name:scrub(row.name)}));
}
export function assignmentLabelSql(label:string,project:string) {
 return `CASE WHEN ${label} LIKE 'audit:%' THEN COALESCE((SELECT o.display_name FROM audit_actor_links l
 JOIN oa_operators o ON o.id=l.owner_id WHERE l.label=${label} AND o.id IN
 (SELECT id FROM (${projectAssigneesSql.replace('t.project=?',`t.project=${project}`)})) LIMIT 1),'Former member') ELSE ${label} END`;
}
export const issueAssigneeSql=(issue='i')=>`(SELECT ${assignmentLabelSql('a.label','a.project')} FROM issue_assignments a WHERE a.project=${issue}.project AND a.issue=${issue}.id)`;
export async function resolveAssignments(db:D1Database, project:string) {
 const rows=(await s(db,`SELECT a.*,${assignmentLabelSql('a.label','a.project')} display_label,
 (SELECT l.owner_id FROM audit_actor_links l WHERE l.label=a.label LIMIT 1) member
 FROM issue_assignments a WHERE a.project=?`,project).all<any>()).results;
 return rows.map(({display_label,...row})=>({...row,label:display_label? scrub(display_label):null}));
}
