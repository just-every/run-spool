import { base32 } from './format';
export const shortIdTables: Record<string, string[]> = {
 short_id_prefixes: ['prefix', 'project', 'next', 'created'],
 issue_short_ids: ['short_id', 'project', 'issue', 'assigned', 'number', 'created'],
 issue_short_id_moves: ['project', 'correction', 'short_id', 'direction', 'from_issue', 'to_issue', 'created'],
};
export const shortIdDefaults = (data: any) => ({ ...Object.fromEntries(Object.keys(shortIdTables).map(name => [name, []])), ...data });
function assert(ok: unknown): asserts ok { if (!ok) throw new Error('Archive short ID'); }
const integer = (value: any, min = 0) => Number.isSafeInteger(value) && value >= min;
/** Restore copies every ID and alias byte for byte; an archive cannot invent, reuse or orphan one. */
export function validateShortIdArchive(data: any) {
 const projects = new Set(data.projects.map((p: any) => p.id)), issues = new Map<string, any>(data.issues.map((i: any) => [i.id, i]));
 const prefixes = new Map<string, any>(), ids = new Map<string, any>(), numbers = new Set<string>();
 for (const row of data.short_id_prefixes) {
  assert(typeof row.prefix === 'string' && /^[A-Z0-9]+(?:-[A-Z0-9]+)*(?:_[1-9][0-9]*)?$/.test(row.prefix) && projects.has(row.project) && !prefixes.has(row.project) && ![...prefixes.values()].some(p => p.prefix === row.prefix) && integer(row.next, 1) && integer(row.created));
  prefixes.set(row.project, row);
 }
 for (const row of data.issue_short_ids) {
  const prefix = prefixes.get(row.project), key = row.project + '\n' + row.number;
  assert(prefix && integer(row.number, 1) && row.number < prefix.next && row.short_id === `${prefix.prefix}-${base32(row.number)}` && !ids.has(row.short_id) && !numbers.has(key) && integer(row.created));
  assert(issues.get(row.issue)?.project === row.project && issues.get(row.assigned)?.project === row.project);
  ids.set(row.short_id, row); numbers.add(key);
 }
 const moves = new Set<string>();
 for (const row of data.issue_short_id_moves) {
  const key = JSON.stringify([row.correction, row.short_id, row.direction]);
  assert(ids.get(row.short_id)?.project === row.project && data.grouping_corrections.some((c: any) => c.id === row.correction && c.project === row.project && c.state !== 'preview') && ['apply', 'undo'].includes(row.direction) && issues.get(row.from_issue)?.project === row.project && issues.get(row.to_issue)?.project === row.project && !moves.has(key) && integer(row.created));
  moves.add(key);
 }
}
