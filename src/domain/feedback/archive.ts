import { scrub } from '../privacy';
import { validateOccurrence } from '../occurrences';
import { feedbackLimits } from './input';

export const feedbackTables = { feedback: ['project', 'id', 'message', 'digest', 'received', 'event_id', 'occurrence'] };
export const feedbackOutcomes = ['feedback_accepted', 'feedback_duplicate', 'feedback_conflict', 'feedback_invalid', 'feedback_oversized', 'feedback_budget', 'feedback_rate_limited', 'feedback_withdrawn'];
export const feedbackDefaults = (data: any) => ({ feedback: [], ...data });
export function validateFeedbackArchive(data: any) {
 const identities = new Set<string>(), counts = new Map<string, number>();
 const events = new Set(data.events.map((row: any) => JSON.stringify([row.project, row.id, row.occurrence])));
 for (const row of data.feedback) {
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
