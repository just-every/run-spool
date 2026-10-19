import { actorKinds, auditActions, outcomes, safeAlias, sources, subjectKinds, type AuditRow } from './types';

// Default exclusion is required until archive restoration APPENDS these facts.
// Base's ordinary restore requires empty tables; replaceable tables delete rows.
// Neither behavior can preserve the target installation's existing chronology.
export const safeAuditExcludedTables = ['spool_audit_events','audit_actor_links'];
export const auditColumns = ['sequence','id','created','source','actor_kind','actor_label','action','subject_kind','subject_label','project_label','outcome','status'] as const;
export function validateAuditRow(value: unknown): asserts value is AuditRow {
 const row=value as AuditRow;
 if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join()!==[...auditColumns].sort().join()||
  !Number.isSafeInteger(row.sequence)||row.sequence<1||typeof row.id!=='string'||!/^[a-f0-9-]{36}$/.test(row.id)||
  !Number.isSafeInteger(row.created)||row.created<0||!sources.includes(row.source)||!actorKinds.includes(row.actor_kind)||!safeAlias(row.actor_label)||
  !auditActions.includes(row.action)||!subjectKinds.includes(row.subject_kind)||!safeAlias(row.subject_label)||
  (row.project_label!==null&&!safeAlias(row.project_label))||!outcomes.includes(row.outcome)||
  (row.status!==null&&(!Number.isInteger(row.status)||row.status<100||row.status>599)))throw new Error('invalid_safe_audit_archive');
}
export function projectAuditRow(value: unknown): AuditRow {
 validateAuditRow(value);
 return Object.fromEntries(auditColumns.map(column=>[column,value[column]])) as AuditRow;
}
export function validateAuditArchive(rows: unknown[]): AuditRow[] {
 const ids=new Set<string>(),sequences=new Set<number>();
 return rows.map(value=>{const row=projectAuditRow(value);if(ids.has(row.id)||sequences.has(row.sequence))throw new Error('duplicate_safe_audit_archive');ids.add(row.id);sequences.add(row.sequence);return row;});
}
