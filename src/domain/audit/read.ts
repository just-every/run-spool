import type { AuditRow } from './types';
import { projectAuditRow } from './archive';

export type AuditCursor = { version: 1; highWater: number; before: number };
const integer=(value:unknown): value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
export async function auditHighWater(db: D1Database): Promise<number> {
 const row=await db.prepare('SELECT COALESCE(MAX(sequence),0) high FROM spool_audit_events').first<{high:number}>();
 if(!row||!integer(row.high)||row.high>=Number.MAX_SAFE_INTEGER)throw new Error('audit_sequence_unavailable');
 return row.high;
}
export function decodeAuditCursor(encoded: string): AuditCursor {
 let cursor: AuditCursor;
 try { cursor=JSON.parse(atob(encoded)); } catch { throw new Error('invalid_audit_cursor'); }
 if(!cursor||Object.keys(cursor).sort().join()!=='before,highWater,version'||cursor.version!==1||!integer(cursor.highWater)||!integer(cursor.before)||cursor.before>cursor.highWater+1)throw new Error('invalid_audit_cursor');
 return cursor;
}
export async function auditPage(db: D1Database, encoded?: string, limit=50) {
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('invalid_audit_limit');
 const high=await auditHighWater(db),cursor=encoded?decodeAuditCursor(encoded):{version:1 as const,highWater:high,before:high+1};
 if(cursor.highWater>high)throw new Error('invalid_audit_cursor');
 const result=await db.prepare('SELECT * FROM spool_audit_events WHERE sequence<=? AND sequence<? ORDER BY sequence DESC LIMIT ?')
  .bind(cursor.highWater,cursor.before,limit+1).all<AuditRow>();
 const rows=result.results.slice(0,limit).map(projectAuditRow),last=rows.at(-1);
 return {version:1,scope:'organization',rows,highWater:cursor.highWater,
  next:result.results.length>limit&&last?btoa(JSON.stringify({...cursor,before:last.sequence})):null,
  coverage:'Request entries record HTTP outcomes. Transaction and service entries record the facts supplied by their writers.'};
}

export async function auditExportPage(db: D1Database, highWater: number, after=0) {
 const result=await db.prepare('SELECT * FROM spool_audit_events WHERE sequence<=? AND sequence>? ORDER BY sequence LIMIT 250').bind(highWater,after).all<AuditRow>();
 return result.results.map(projectAuditRow);
}
