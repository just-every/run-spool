import {prepareScrubbing} from '../scrubbing/model';
import { filterCategory } from '../filters/categories';
import { ingestBatch, ingestFailure, outcomeStatement, recordIngest, stmt, type IngestScope } from '../admission';
import { tombstone } from '../../modules/portability/journal.mjs';
import { state } from '../../modules/portability/storage.mjs';
import { feedbackCoverage, type FeedbackInput } from './input';

export async function admitFeedback(c: any, scope: IngestScope, input: FeedbackInput): Promise<Response> {
 const db = c.env.DB, project = scope.project;
 const duplicate = async (row: any) => {
  const same = row.digest === input.digest;
  await recordIngest(c, scope, same ? 'feedback_duplicate' : 'feedback_conflict');
  return c.json({ id: input.id, outcome: same ? 'duplicate' : 'conflict', coverage: feedbackCoverage }, same ? 200 : 409);
 };
 try {
  const privacy=await prepareScrubbing(db,project,{message:input.message});
  if(!privacy.document.message.trim())return c.json({outcome:'rejected',reason:'scrubbing_removed_feedback_message'},422);
  input={...input,message:privacy.document.message};
  const filters = await filterCategory(c, scope, input);
  if (filters.length) return c.json({ id: input.id, outcome: 'filtered', filters, coverage: feedbackCoverage }, 202);
  const existing = await stmt(db, 'SELECT digest FROM feedback WHERE project=? AND id=?', project, input.id).first();
  if (existing) return duplicate(existing);
  const before = await state(db), key = await tombstone(before.source_identity, 'feedback', { project, id: input.id });
  const withdrawn = await stmt(db, 'SELECT 1 FROM rer_portability_journal WHERE source=? AND tombstone=?', before.source_identity, key).first();
  if (withdrawn) {
   await recordIngest(c, scope, 'feedback_withdrawn');
   return c.json({ outcome: 'rejected', reason: 'feedback_withdrawn' }, 409);
  }
  // Resolve the reference in the INSERT transaction, never from another project
  // or by following an event ID again on a later read.
  await ingestBatch(c, scope, [...privacy.jobs,
   stmt(db, `INSERT INTO spool_authority_guards(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND source_identity=? AND epoch=?) AND NOT EXISTS(SELECT 1 FROM rer_portability_journal WHERE source=? AND tombstone=?) THEN 1 ELSE 0 END`, before.source_identity, before.epoch, before.source_identity, key),
   stmt(db, `INSERT INTO feedback(project,id,message,digest,received,event_id,occurrence)
    VALUES(?,?,?,?,CAST(strftime('%s','now') AS INTEGER)*1000+CAST(substr(strftime('%f','now'),4,3) AS INTEGER),?,
     (SELECT occurrence FROM events WHERE project=? AND id=?))`, project, input.id, input.message, input.digest, input.eventId, project, input.eventId),
   outcomeStatement(db, project, 'feedback_accepted'),
  ]);
  return c.json({ id: input.id, outcome: 'accepted', coverage: feedbackCoverage }, 201);
 } catch (error) {
  const retry = await stmt(db, 'SELECT digest FROM feedback WHERE project=? AND id=?', project, input.id).first();
  if (retry) return duplicate(retry);
  const reason = String(error).includes('feedback_rate_limited') ? 'feedback_rate_limited' : String(error).includes('feedback_budget') ? 'feedback_budget' : null;
  if (reason) {
   await recordIngest(c, scope, reason);
   if (reason === 'feedback_rate_limited') c.header('Retry-After', '60');
   return c.json({ outcome: 'rejected', reason, coverage: feedbackCoverage }, 429);
  }
  return ingestFailure(c, scope, error);
 }
}
