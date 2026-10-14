import { canonical, hash } from '../privacy';
import { validateMap } from '../artifacts';
import { repairLink } from '../repairs/input';

// Only content columns are rewritten. Keys, grouping inputs and immutable
// import custody cannot be silently changed or dropped with a neighbour's data.
export const ownerCaptureColumns: Record<string, string[]> = {
 projects: ['name'], issues: ['title'], events: ['payload','diagnostic'], artifacts: ['payload'],
 repairs: ['note','exercise_note','link'], repair_checks: ['name','note'], alerts: ['payload'],
 alert_rules: ['name'], rer_mail_development_outbox: ['message'],
 reproducers: ['spec'], reproducer_runs: ['observation','checks'], fix_workflows: ['grant_spec'], fix_receipts: ['detail'],
};
const jsonColumns = new Set(['payload','diagnostic','message','spec','observation','checks','grant_spec','detail']);
const quote = (name: string) => '"' + name.replaceAll('"','""') + '"';
const contains = (value: unknown, needles: string[]) => typeof value === 'string' && needles.some(needle => value.includes(needle));
const containsValue = (value: any, needles: string[]): boolean => typeof value==='string' ? contains(value,needles) : Array.isArray(value) ? value.some(item=>containsValue(item,needles)) : !!value && typeof value==='object' && Object.entries(value).some(([key,item])=>contains(key,needles)||containsValue(item,needles));
export const sqlQuote = quote;
export type CaptureChange = { table: string; key: Record<string,unknown>; before: Record<string,unknown>; after: Record<string,unknown> };
export async function ownerIdentifiers(db: D1Database, id: string) {
 const owner = await db.prepare('SELECT id,email,display_name FROM oa_operators WHERE id=?').bind(id).first<any>();
 if (!owner) throw new Error('subject_not_found');
 const identities = (await db.prepare('SELECT subject FROM oa_external_identities WHERE operator_id=?').bind(id).all<any>()).results;
 const remembered=(await db.prepare(`SELECT json_extract(s.row_json,'$.subject') AS subject FROM rer_erasure_scope s JOIN rer_erasure_operations o ON o.id=s.operation WHERE o.entity='installation-owner' AND json_extract(o.subject,'$.id')=? AND s.kind='graph' AND s.table_name='oa_external_identities'`).bind(id).all<any>()).results;
 return [...new Set([owner.id,owner.email,owner.display_name,...identities.map(row => row.subject),...remembered.map(row=>row.subject)].filter(Boolean))] as string[];
}
// An identifier is the owner's only as a whole token: the characters around it must not continue a word, address or
// identifier ("Sam." or "Sam:", but not "Sample", nor an address that ends a longer address). One found inside a longer
// token cannot be told apart from other people's text, so it holds the plan instead of being rewritten. Longer needles
// go first, so a display name inside the owner's own address is erased with that address.
const continuesBefore = /(?:[\p{L}\p{M}\p{N}_]|[\p{L}\p{M}\p{N}_][.+@-])$/u, continuesAfter = /^(?:[\p{L}\p{M}\p{N}_]|[.+@-][\p{L}\p{M}\p{N}_])/u;
function redactText(text: string, needles: string[]) {
 return [...needles].sort((a,b) => b.length-a.length).reduce((value, needle) => {
  for (let at = value.indexOf(needle); at >= 0; at = value.indexOf(needle, at + needle.length))
   if (continuesBefore.test(value.slice(Math.max(0,at-3),at)) || continuesAfter.test(value.slice(at+needle.length,at+needle.length+3))) throw new Error('identifier_inside_longer_token');
  return value.replaceAll(needle, '[erased]');
 }, text);
}
function replace(value: any, needles: string[]): any {
 if (typeof value === 'string') return redactText(value, needles);
 if (Array.isArray(value)) return value.map(item => replace(item, needles));
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => {
  if (contains(key, needles)) throw new Error('identifier_in_structural_key');
  return [key, replace(item, needles)];
 }));
 return value;
}
export async function capturePlan(db: D1Database, needles: string[]) {
 const changes: CaptureChange[] = [], counts: Record<string,number> = {};
 let hold: string | null = needles.some(needle=>'[erased]'.includes(needle))?'identifier_collides_with_redaction_marker':null;
 for (const [table, columns] of Object.entries(ownerCaptureColumns)) {
  const info = (await db.prepare(`PRAGMA table_info(${quote(table)})`).all<any>()).results;
  const keys = info.filter(row => row.pk).sort((a,b) => a.pk-b.pk).map(row => row.name);
  const rows = (await db.prepare(`SELECT * FROM ${quote(table)}`).all<any>()).results;
  for (const row of rows) {
   if(Object.entries(row).some(([column,value])=>!columns.includes(column) && contains(value,needles)))hold='identifier_in_structural_key';
   const after: Record<string,unknown> = {}, before: Record<string,unknown> = {};
   for (const column of columns) {
    if (typeof row[column] !== 'string') continue;
    let value: any;
    try { value = jsonColumns.has(column) ? JSON.parse(row[column]) : row[column]; } catch { hold = 'unreadable_captured_content'; continue; }
    if (!containsValue(value, needles)) continue;
    try {
     if (table === 'events' && column === 'payload') {
      const {message, breadcrumbs, ...structural} = value;
      if (containsValue(structural, needles)) throw new Error('identifier_in_event_grouping_or_identity');
      value = {...value, message: replace(message,needles), breadcrumbs: replace(breadcrumbs,needles)};
     } else value = replace(value, needles);
     let encoded = jsonColumns.has(column) ? JSON.stringify(value) : value;
     if (table === 'artifacts') encoded = validateMap(value);
     if (table === 'repairs' && column === 'link') encoded = repairLink(encoded);
     before[column] = row[column]; after[column] = encoded;
     if (table === 'artifacts' || table === 'events' && column === 'payload') { before.digest = row.digest; after.digest = await hash(encoded); }
    } catch (error) { hold = error instanceof Error ? error.message : 'unsupported_captured_content'; }
   }
   if (Object.keys(after).length) {
    changes.push({table,key:Object.fromEntries(keys.map(key => [key,row[key]])),before,after});
    counts[table] = (counts[table] ?? 0) + 1;
   }
  }
 }
 return { changes, counts, hold, hash: await hash(canonical(changes)) };
}
export function captureStatements(db: D1Database, changes: CaptureChange[]) {
 return changes.flatMap(({table,key,before,after}) => {
  const match = Object.keys({...key,...before}).map(column => `${quote(column)} IS ?`).join(' AND ');
  const values = Object.values({...key,...before});
  return [
   db.prepare(`INSERT INTO rer_erasure_guard(value,scope) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM ${quote(table)} WHERE ${match}) THEN 1 ELSE 0 END`).bind(...values as any[]),
   db.prepare(`UPDATE ${quote(table)} SET ${Object.keys(after).map(column => `${quote(column)}=?`).join(',')} WHERE ${match}`).bind(...Object.values(after) as any[],...values as any[]),
  ];
 });
}
