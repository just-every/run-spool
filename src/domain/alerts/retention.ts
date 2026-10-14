import { statement as s } from './types';
import { correctionMembership, originalMembership } from '../operators/provenance';

export const RETAINED_HEADLINE = '[headline unavailable after retention]';

// Alerts have no headline occurrence key. Withdraw their diagnostic copies for
// every issue the exact erased occurrence occupied, including intermediate
// corrections and undo, while retaining the alert and delivery chronology.
export function withdrawAlertEvidence(db: D1Database, project: string, cutoff: number, candidates: string, time: number) {
 const affected = `WITH removed AS (
  SELECT e.* FROM events e WHERE e.project=? AND e.received<? AND EXISTS(
   SELECT 1 FROM json_each(?) candidate WHERE e.project=json_extract(candidate.value,'$.project')
    AND e.id=json_extract(candidate.value,'$.id') AND e.occurrence=json_extract(candidate.value,'$.occurrence'))
 ), affected AS (
  SELECT a.id FROM alerts a WHERE a.project=? AND EXISTS(SELECT 1 FROM removed e
   WHERE a.issue=e.issue OR ${originalMembership('e', 'a.issue')} OR ${correctionMembership('e', 'a.issue')})
 )`;
 const statement = (sql: string, ...args: any[]) => s(db, `${affected} ${sql}`, project, cutoff, candidates, project, ...args);
 const deliveries = 'SELECT id FROM alert_intents WHERE project=? AND alert_id IN (SELECT id FROM affected)';
 return [
  statement("UPDATE alerts SET payload=json_set(payload,'$.title',?) WHERE id IN (SELECT id FROM affected) AND payload IS NOT NULL", RETAINED_HEADLINE),
  statement(`UPDATE alert_history SET code='retention_removed',updated=?,
   state=CASE WHEN state IN ('pending','queued','retrying','blocked') THEN 'cancelled' WHEN state='sending' THEN 'uncertain' ELSE state END
   WHERE project=? AND alert_id IN (SELECT id FROM affected)`, time, project),
  // This durable cancellation also fences an expansion which read its intent
  // before retention. Migration guards refuse late private-copy inserts.
  statement(`UPDATE alert_intents SET body=json_set(body,'$.title',?),state='cancelled',code='retention_removed'
   WHERE project=? AND alert_id IN (SELECT id FROM affected)`, RETAINED_HEADLINE, project),
  statement(`UPDATE alert_mail_jobs SET message=json_set(message,'$.subject',?,'$.text',?),claim=NULL,claim_until=NULL,code='retention_removed',
   state=CASE WHEN state IN ('queued','blocked') THEN 'blocked' WHEN state='sending' THEN 'uncertain' ELSE state END
   WHERE project=? AND id IN (${deliveries})`, RETAINED_HEADLINE, RETAINED_HEADLINE, project, project),
  statement(`DELETE FROM rer_mail_development_outbox WHERE json_valid(message) AND json_extract(message,'$.deliveryId') IN (${deliveries})`, project),
  // Immutable integration envelopes cannot be rewritten under their old
  // fingerprint. Remove those private copies; safe attempts/history remain.
  ...['integration_deliveries', 'integration_replays'].map(table => statement(
   `DELETE FROM ${table} WHERE namespace=? AND id IN (${deliveries})`, 'spool.' + project, project)),
 ];
}
