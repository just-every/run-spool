import { actorKinds, auditActions, outcomes, safeAlias, sources, subjectKinds, type AuditRow } from './types';

// Safe facts never travel as a Base table: ordinary restore requires empty
// tables and replaceable tables delete rows, so neither could preserve the
// destination's own chronology. They travel as the `safe_audit` payload and are
// appended when the restore commits (0053_audit_transactions.sql). Private
// alias links and per-batch context never travel.
export const safeAuditExcludedTables = ['spool_audit_events','audit_actor_links','audit_context','audit_legacy_actions','audit_legacy_labels','audit_restore_staging'];
export const SAFE_AUDIT_PAYLOAD = 'safe_audit';
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

/** Every permanent fact, oldest first, as JSON lines. */
export function auditPayload(db: D1Database) {
 return {
  async produce() {
   const encoder=new TextEncoder();let after=0;
   return new ReadableStream<Uint8Array>({async pull(controller){
    const rows=(await db.prepare('SELECT * FROM spool_audit_events WHERE sequence>? ORDER BY sequence LIMIT 250').bind(after).all<AuditRow>()).results.map(projectAuditRow);
    if(!rows.length){controller.close();return;}
    after=rows.at(-1)!.sequence;controller.enqueue(encoder.encode(rows.map(row=>JSON.stringify(row)+'\n').join('')));
   }});
  },
  // Verified before the restore's D1 commit; staged for that commit to append.
  async consume(source: ReadableStream<Uint8Array>) {
   const text=await new Response(source).text(),lines=text?text.split('\n'):[];
   if(lines.pop()!=='')throw new Error('invalid_safe_audit_archive');
   const rows=validateAuditArchive(lines.map(line=>JSON.parse(line)));
   if(rows.some((row,index)=>index&&row.sequence<=rows[index-1].sequence))throw new Error('invalid_safe_audit_archive');
   const job=(await db.prepare('SELECT import_job FROM rer_portability_state WHERE id=1').first<{import_job:string|null}>())?.import_job;
   if(!job)throw new Error('invalid_safe_audit_archive');
   const statements=[db.prepare('DELETE FROM audit_restore_staging WHERE import_id=?').bind(job),db.prepare('INSERT INTO audit_restore_staging VALUES(?,0,NULL)').bind(job)];
   for(let offset=0;offset<rows.length;offset+=200)statements.push(db.prepare('INSERT INTO audit_restore_staging SELECT ?,?+key+1,value FROM json_each(?)').bind(job,offset,JSON.stringify(rows.slice(offset,offset+200))));
   for(let offset=0;offset<statements.length;offset+=50)await db.batch(statements.slice(offset,offset+50));
  },
 };
}
