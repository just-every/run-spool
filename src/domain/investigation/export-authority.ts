import { ownerSession } from '../../auth/session.server';
import { resolveMembership } from '../members/resolver';
import { agentProject } from '../agent-access';

/** Capture only server-established authority; every delivery batch resolves it again. */
export async function exportAuthority(c: any, project: string) {
 const db: D1Database = c.env.DB, grant = await agentProject(c.req.raw,db);
 const session = grant ? null : await ownerSession(c.req.raw,c.env,resolveMembership);
 if (!grant && !session || grant && grant !== project) throw new Error('Export authority changed');
 return {agent:!!grant,async check() {
  if (grant) {
   if (await agentProject(c.req.raw,db) !== grant) throw new Error('Export authority changed');
  } else {
   const current = await ownerSession(c.req.raw,c.env,resolveMembership);
   if (!current || current.id !== session!.id || current.operator.version !== session!.operator.version) throw new Error('Export authority changed');
  }
  if (!await db.prepare('SELECT 1 FROM projects WHERE id=?').bind(project).first()) throw new Error('Export project erased');
 }};
}
