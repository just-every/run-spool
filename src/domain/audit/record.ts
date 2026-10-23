import { actorKinds, auditActions, outcomes, safeAlias, sources, subjectKinds, type AuditActor, type AuditFact } from './types';

/** No session or credential admitted the request. */
export const unverified = (actor: AuditActor) => actor.kind==='anonymous'||actor.kind==='unknown';
// Refusals of unadmitted requests are sampled installation-wide: one is kept only while none of
// the latest facts is such a refusal from the past hour, so repeating them adds no permanent row.
const UNVERIFIED_SAMPLE = 20, UNVERIFIED_WINDOW = 3_600_000;
const unverifiedRefusal = "source='request' AND actor_kind IN ('anonymous','unknown') AND status>=400";

/** Statement form belongs inside the same fenced batch as the mutation. */
export function auditStatement(db: D1Database, fact: AuditFact): D1PreparedStatement {
 const id=fact.id??crypto.randomUUID(), created=fact.created??Date.now(), status=fact.status??null;
 if (!/^[a-f0-9-]{36}$/.test(id) || !Number.isSafeInteger(created) || created<0 ||
  !sources.includes(fact.source) || !actorKinds.includes(fact.actor.kind) || !safeAlias(fact.actor.label) ||
  !auditActions.includes(fact.action) || !subjectKinds.includes(fact.subject.kind) || !safeAlias(fact.subject.label) ||
  (fact.projectLabel!=null&&!safeAlias(fact.projectLabel)) || !outcomes.includes(fact.outcome) ||
  (status!==null&&(!Number.isInteger(status)||status<100||status>599))) throw new Error('invalid_safe_audit_fact');
 const sampled=fact.source==='request'&&unverified(fact.actor)&&status!==null&&status>=400;
 return db.prepare(`INSERT INTO spool_audit_events(id,created,source,actor_kind,actor_label,action,subject_kind,subject_label,project_label,outcome,status) SELECT ?,?,?,?,?,?,?,?,?,?,?${sampled?` WHERE NOT EXISTS(SELECT 1 FROM (SELECT source,actor_kind,status,created FROM spool_audit_events ORDER BY sequence DESC LIMIT ${UNVERIFIED_SAMPLE}) WHERE ${unverifiedRefusal} AND created>=?)`:''}`)
  .bind(id,created,fact.source,fact.actor.kind,fact.actor.label,fact.action,fact.subject.kind,fact.subject.label,fact.projectLabel??null,fact.outcome,status,...sampled?[created-UNVERIFIED_WINDOW]:[]);
}
export async function recordAudit(db: D1Database, fact: AuditFact): Promise<void> { await auditStatement(db,fact).run(); }
export const responseOutcome = (status: number): AuditFact['outcome'] => status===202?'accepted':status<400?'succeeded':status===401||status===403?'denied':status===409||status===410||status===412?'conflict':status<500?'invalid':'failed';
