import { validatePrivate } from './private';
import { scrub } from '../privacy';
import { validateOccurrence } from '../occurrences';
import { feedbackLimits } from './input';

export const feedbackTables = { feedback: ['project', 'id', 'message', 'digest', 'received', 'event_id', 'occurrence', 'private_data'] };
export const feedbackOutcomes = ['feedback_accepted', 'feedback_duplicate', 'feedback_conflict', 'feedback_invalid', 'feedback_oversized', 'feedback_budget', 'feedback_rate_limited', 'feedback_withdrawn'];
export const feedbackDefaults = (data: any) => ({ ...data, feedback: (data.feedback??[]).map((row:any)=>({private_data:null,...row})) });
export function validateFeedbackArchive(data: any) {
 const identities = new Set<string>(), counts = new Map<string, number>();
 const events = new Set(data.events.map((row: any) => JSON.stringify([row.project, row.id, row.occurrence])));
 for (const row of data.feedback) {
  validatePrivate(row.private_data);
  const key = JSON.stringify([row.project, row.id]);
  if (!/^(?:[a-f0-9]{32}|user-report-[a-f0-9]{32})$/.test(row.id) || identities.has(key)) throw new Error('Archive feedback identity');
  identities.add(key);
  const count = (counts.get(row.project) ?? 0) + 1; counts.set(row.project, count);
  if (count > feedbackLimits.retained || typeof row.message !== 'string' || !row.message.trim() || row.message.length > feedbackLimits.message || scrub(row.message) !== row.message || !/^[a-f0-9]{64}$/.test(row.digest) || !Number.isSafeInteger(row.received) || row.received < 0) throw new Error('Archive feedback content');
  if (row.event_id !== null && (typeof row.event_id !== 'string' || !/^[a-f0-9]{32}$/.test(row.event_id))) throw new Error('Archive feedback event reference');
  if (row.id.startsWith('user-report-') && row.id !== 'user-report-' + row.event_id) throw new Error('Archive legacy feedback identity');
  if (row.occurrence !== null) {
   validateOccurrence(row.occurrence);
   if (!row.event_id || !events.has(JSON.stringify([row.project, row.event_id, row.occurrence]))) throw new Error('Archive feedback occurrence reference');
  }
 }
 for (const row of data.audit.filter((entry: any) => entry.kind === 'feedback_withdrawn')) {
  const detail = JSON.parse(row.detail);
  if (Object.keys(detail).join() !== 'count' || detail.count !== 1) throw new Error('Archive feedback withdrawal audit');
 }
}

/** Exact additive-column translation for archives made before private review. */
export function beforeFeedbackReview(table:any,manifest:any){
 if(table.name!=='feedback'||manifest.migrations?.includes('0109_feedback_review.sql'))return table;
 // Unrecorded inventories may already carry private review. Preserve the
 // current descriptor only when the archive declares that column; the caller
 // still compares the complete SQL, columns and behavior inventory exactly.
 if(!manifest.migrations?.length&&manifest.schemaObjects!==undefined&&manifest.tables?.find((entry:any)=>entry.name==='feedback')?.columns?.some((column:any)=>column.name==='private_data'))return table;
 return {...table,sql:table.sql.replace(/, private_data TEXT DEFAULT NULL\s+CHECK\(private_data IS NULL OR \(json_valid\(private_data\) AND length\(private_data\)<=240000\)\)/,''),columns:table.columns.filter((column:any)=>column.name!=='private_data')};
}
