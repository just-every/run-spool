import { AuthError } from '../modules/operator-auth/index.mjs';
import type { ownerSession } from '../auth/session.server';
import { agentGuard, nativeAttribution, type NativeAuthority } from './agent-door/native-authority';
import { auditContextStatements } from './audit/context';

export type OwnerSession = NonNullable<Awaited<ReturnType<typeof ownerSession>>>;

// An owner write admitted before an owner handoff must not commit after it.
// The session that admitted the request is checked again inside the same D1
// batch, before and after its statements: still unrevoked and unexpired, at its
// operator's current version, and that operator still the active owner.
export const authorityGuard = (db: D1Database, session: NativeAuthority) => session.kind === 'agent' ? agentGuard(db,session) : db.prepare(`INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(
 SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
 WHERE s.id=? AND o.id=? AND o.version=? AND s.operator_version=o.version
  AND s.revoked_at IS NULL AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
  AND o.status='active' AND ${session.membership ? `EXISTS(SELECT 1 FROM spool_members m WHERE m.id=? AND m.operator_id=o.id AND m.version=? AND m.role=? AND m.organization=? AND m.state='active'
   ${session.membership.project ? `AND EXISTS(SELECT 1 FROM spool_project_teams t WHERE t.project=? AND t.organization=m.organization)
    ${session.membership.role==='admin'?'':`AND EXISTS(SELECT 1 FROM spool_project_grants g WHERE g.member=m.id AND g.project=? AND g.role=?)`}`:''})` : "o.role='owner'"}) THEN 1 ELSE 0 END`).bind(session.id, session.operator.id, session.operator.version,
 ...session.membership ? [session.membership.id,session.membership.version,session.membership.role,session.membership.organization,
  ...session.membership.project ? [session.membership.project,...session.membership.role==='admin'?[]:[session.membership.project,session.membership.projectRole]]:[]]:[]);

export async function ownerBatch(db: D1Database, session: NativeAuthority, statements: D1PreparedStatement[]) {
 // The request's audit context opens and closes the batch: a journal row or an
 // explicit commit inside it records the attributed fact in this transaction.
 const [open, close] = auditContextStatements(db);
 try { return (await db.batch([open, authorityGuard(db, session), ...statements, ...(session.kind==='agent'?[nativeAttribution(db,session)]:[]), authorityGuard(db, session), db.prepare('DELETE FROM spool_authority_guards'), close])).slice(2, session.kind==='agent'?-4:-3); }
 catch (error) { if (/CHECK constraint failed: ok=1/.test(String(error))) throw new AuthError('authority_changed', 409); throw error; }
}

// For writes that span several batches (retention, restore through Base's
// portability engine): every batch commits only under the same check. Once one
// is refused, later batches pass unchecked so the engine's own cleanup and abort
// run before the refusal reaches the caller.
export function ownerDatabase(db: D1Database, session: NativeAuthority): D1Database {
 let refused = false;
 return new Proxy(db, { get(target, key) {
  if (key === 'batch') return async (statements: D1PreparedStatement[]) => {
   if (refused) return target.batch(statements);
   try { return await ownerBatch(target, session, statements); }
   catch (error) { if (error instanceof AuthError) refused = true; throw error; }
  };
  const value = Reflect.get(target, key, target);
  return typeof value === 'function' ? value.bind(target) : value;
 } });
}
