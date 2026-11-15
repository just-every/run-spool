import { Details } from './Details';
import type { OrganizationAccess, OrganizationData } from './Members';

/** Team labels group projects; membership follows actual organization/project access. */
export function TeamMembers({ data, projects }: { data: OrganizationData; projects: OrganizationAccess['projects'] }) {
  const teams = [...new Set(data.teams.map(row => row.team))];
  return <details><summary>Team members</summary>{teams.map(team => {
    const projectIds = new Set(data.teams.filter(row => row.team === team).map(row => row.project));
    const members = data.members.filter(member => member.state !== 'removed' && (member.role === 'owner' || member.role === 'admin' || data.grants.some(grant => grant.member === member.id && projectIds.has(grant.project))));
    return <div className="data-row" key={team}><div><strong>{team}</strong><p>{members.length} {members.length === 1 ? 'member' : 'members'}</p></div><Details title={`${team} members`} triggerLabel="View members">
      <p>Membership follows access to this team’s projects. Owners and organization admins have access to every project.</p>
      {!members.length && <p>No members have access to this team.</p>}
      {members.map(member => <div className="data-row" key={member.id}><div><strong>{member.name}</strong><p>{member.email}</p><p>{member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : member.role === 'read-only' ? 'Read only' : 'Member'} · {member.state === 'inert' ? 'Historical · no access' : member.operatorStatus === 'invited' ? 'Invitation pending · no access yet' : member.operatorStatus === 'active' ? 'Active' : 'No active sign-in'}</p><ul>{projects.filter(project => projectIds.has(project.id)).flatMap(project => {
        const grant = data.grants.find(row => row.member === member.id && row.project === project.id);
        const role = member.role === 'owner' || member.role === 'admin' ? 'All project access' : member.role === 'read-only' ? (grant ? 'Read only' : '') : grant?.role === 'maintainer' ? 'Maintainer' : grant?.role === 'member' ? 'Member' : grant ? 'Read only' : '';
        return role ? [<li key={project.id}>{project.name} · {role}</li>] : [];
      })}</ul></div></div>)}
    </Details></div>;
  })}{!teams.length && <p>No project teams yet.</p>}</details>;
}
