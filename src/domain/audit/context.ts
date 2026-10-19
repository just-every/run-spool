import { AsyncLocalStorage } from 'node:async_hooks';
import { authorityHash, randomAuditLabel } from './identity';
import { auditActions, actorKinds, safeAlias, subjectKinds, type AuditAction, type AuditActor, type SubjectKind } from './types';

/** Who is acting on what, already reduced to safe aliases. */
export type AuditScope = { actor: AuditActor; action: AuditAction; subject: { kind: SubjectKind; label: string }; projectLabel: string | null };
const storage = new AsyncLocalStorage<{ scope: AuditScope }>();

export const runAuditScope = <T>(scope: AuditScope, work: () => Promise<T>) => storage.run({ scope }, work);
export function currentAuditScope(): AuditScope {
 const store = storage.getStore(); if (!store) throw new Error('audit_context_required');
 return store.scope;
}
/** A door whose authority is proven inside its handler (a run token) names its actor there. */
export function attributeAuditScope(actor: AuditActor) {
 const store = storage.getStore(); if (!store) throw new Error('audit_context_required');
 store.scope = { ...store.scope, actor };
}

function openContext(db: D1Database, scope: AuditScope) {
 if (!actorKinds.includes(scope.actor.kind) || !safeAlias(scope.actor.label) || !auditActions.includes(scope.action) || !subjectKinds.includes(scope.subject.kind) ||
  !safeAlias(scope.subject.label) || (scope.projectLabel !== null && !safeAlias(scope.projectLabel))) throw new Error('invalid_audit_context');
 return db.prepare('INSERT INTO audit_context(slot,actor_kind,actor_label,action,subject_kind,subject_label,project_label,created) VALUES(1,?,?,?,?,?,?,?)')
  .bind(scope.actor.kind, scope.actor.label, scope.action, scope.subject.kind, scope.subject.label, scope.projectLabel, Date.now());
}
/** The batch's first and last statements; results are returned without them. */
export function auditContextStatements(db: D1Database, scope: AuditScope = currentAuditScope()): [D1PreparedStatement, D1PreparedStatement] {
 return [openContext(db, scope), db.prepare('DELETE FROM audit_context')];
}
export async function auditedBatch(db: D1Database, statements: D1PreparedStatement[], scope?: AuditScope) {
 const [open, close] = auditContextStatements(db, scope);
 return (await db.batch([open, ...statements, close])).slice(1, -1);
}
/** For a change that writes no journal row: place it right after the statement
 * whose effect it states (a condition may use changes()). Journal rows commit
 * the fact themselves; either way one batch yields at most one fact. */
export const auditCommit = (db: D1Database, condition = '1', ...binds: unknown[]) =>
 db.prepare(`UPDATE audit_context SET committed=1 WHERE ${condition}`).bind(...binds);

/** A project created in this batch gets its private alias link inside the same
 * batch, and the fact names the new project rather than the installation. */
export async function auditProjectBinding(db: D1Database, project: string): Promise<D1PreparedStatement[]> {
 const [lookup, projectHash] = await Promise.all([authorityHash('subject:project', project), authorityHash('project', project)]);
 return [
  db.prepare("INSERT INTO audit_actor_links(kind,lookup_hash,label,owner_hash,project_hash,owner_id,project,created) SELECT 'subject:project',?,?,NULL,?,NULL,?,? WHERE EXISTS(SELECT 1 FROM projects WHERE id=?) ON CONFLICT(kind,lookup_hash) DO NOTHING")
   .bind(lookup, randomAuditLabel(), projectHash, project, Date.now(), project),
  db.prepare("UPDATE audit_context SET subject_kind='project',subject_label=(SELECT label FROM audit_actor_links WHERE kind='subject:project' AND lookup_hash=?),project_label=(SELECT label FROM audit_actor_links WHERE kind='subject:project' AND lookup_hash=?) WHERE committed=0")
   .bind(lookup, lookup),
 ];
}
