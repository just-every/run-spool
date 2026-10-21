import { tombstone } from '../modules/portability/journal.mjs';
import { state, statement, guard } from '../modules/portability/storage.mjs';
import { occurrenceKey, occurrenceKeys, type OccurrenceTable } from './occurrences';
import { portability } from './portability';
import { scrub } from './privacy';
import { retentionAlertStatements } from './alerts/spikes';
import { withdrawAlertEvidence, RETAINED_HEADLINE } from './alerts/retention';
import { retentionExposureStatements } from './exposure/retention';
import { feedbackRetentionStatements } from './feedback/custody';
import { commitRetentionStatements } from './commits/retention';

type Candidate = Record<string, string>;
const predicates = {
 events: 'received<?',
 artifacts: 'created<? AND NOT EXISTS(SELECT 1 FROM events WHERE events.project=artifacts.project AND events.release=artifacts.release AND events.build=artifacts.build)',
};
const transferInventory = "SELECT json_group_array(name) AS inventory FROM (SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'rer_portability_snap_*' OR name GLOB 'rer_portability_stage_*') ORDER BY name)";
async function erase(db: D1Database, source: string, table: OccurrenceTable, rows: Candidate[], project: string, cutoff: number) {
 const jobs: D1PreparedStatement[] = [];
 const match = occurrenceKeys[table].map(key => `${table}.${key}=json_extract(candidate.value,'$.${key}')`).join(' AND ');
 const eligible = `project=? AND ${predicates[table]}`;
 // Keep bound JSON and statement count bounded even at the retained-event cap.
 for (let offset = 0; offset < rows.length; offset += 50) {
  const candidates = await Promise.all(rows.slice(offset, offset + 50).map(async row => ({ ...row,
   tombstone: await tombstone(source, table, occurrenceKey(table, row)),
   legacy: row.occurrence === 'legacy' ? await tombstone(source, table, occurrenceKey(table, row, true)) : null,
  })));
  const encoded = JSON.stringify(candidates);
  for (const field of ['tombstone', 'legacy']) jobs.push(statement(db,
   `INSERT OR IGNORE INTO rer_portability_journal SELECT ?,json_extract(candidate.value,'$.${field}') FROM json_each(?) candidate WHERE json_extract(candidate.value,'$.${field}') IS NOT NULL AND EXISTS(SELECT 1 FROM ${table} WHERE ${eligible} AND ${match})`, source, encoded, project, cutoff));
  if(table==='events')jobs.push(
   ...withdrawAlertEvidence(db, project, cutoff, encoded, Date.now()),
   statement(db, `DELETE FROM sentry_import_targets WHERE kind='event' AND EXISTS(SELECT 1 FROM events WHERE ${eligible} AND sentry_import_targets.id=json_array(events.project,events.id) AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE ${match}))`,project,cutoff,encoded));
  jobs.push(statement(db, `DELETE FROM ${table} WHERE ${eligible} AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE ${match})`, project, cutoff, encoded));
 }
 return jobs;
}

export async function applyRetention(db: D1Database, project: string, cutoff: number) {
 const transfer = await portability(db), before = await state(db), auditId = crypto.randomUUID();
 const events = (await statement(db, 'SELECT project,id,occurrence FROM events WHERE project=? AND received<?', project, cutoff).all()).results as Candidate[];
 const maps = (await statement(db, 'SELECT project,release,build,debug,occurrence FROM artifacts WHERE project=? AND created<?', project, cutoff).all()).results as Candidate[];
 const retained = (await statement(db, 'SELECT id,occurrence,issue,payload FROM events WHERE project=? AND received>=? ORDER BY received,id', project, cutoff).all()).results as any[];
 // Resolve membership in the write transaction: a correction can move a
 // retained headline after this read. Never reattach its text to its old issue.
 const headlines: D1PreparedStatement[] = [];
 for (let offset = 0; offset < retained.length; offset += 50) {
  const titles = retained.slice(offset, offset + 50).map(row => { const event = JSON.parse(row.payload); return { id: row.id, occurrence: row.occurrence, title: scrub(event.type + ': ' + event.message) }; });
  headlines.push(statement(db, `WITH headlines AS (
   SELECT e.issue,json_extract(candidate.value,'$.title') title FROM events e,json_each(?) candidate
   WHERE e.project=? AND e.id=json_extract(candidate.value,'$.id') AND e.occurrence=json_extract(candidate.value,'$.occurrence')
    AND e.id=(SELECT id FROM events WHERE project=e.project AND issue=e.issue ORDER BY received,id LIMIT 1)
  ) UPDATE issues SET title=(SELECT title FROM headlines WHERE issue=issues.id) WHERE project=? AND id IN (SELECT issue FROM headlines)`, JSON.stringify(titles), project, project));
 }
 const copies = await db.prepare(transferInventory).first<{ inventory: string }>();
 const invalidation = await transfer.invalidateTransfersStatements();
 const eventJobs = await erase(db, before.source_identity, 'events', events, project, cutoff);
 const mapJobs = await erase(db, before.source_identity, 'artifacts', maps, project, cutoff);
 const exposureJobs = await retentionExposureStatements(db, before.source_identity, project, cutoff, Date.now());
 const feedbackJobs = await feedbackRetentionStatements(db, before.source_identity, project, cutoff);
 // The source/epoch guard rejects a competing restore or retention. Each journal
 // INSERT and DELETE uses the same occurrence and predicate inside this batch.
 // A concurrently admitted map reference therefore preserves both map and fence.
 const result = await db.batch([
  guard(db, 'EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NULL AND source_identity=? AND epoch=?)', before.source_identity, before.epoch),
  // A newly created export must not leave an unlisted snapshot holding erased
  // rows. If transfer custody changed after discovery, the whole apply retries.
  guard(db, `(${transferInventory})=?`, copies!.inventory),
  ...invalidation,
  // The journal row is written once and never revised: it counts the events
  // this batch removes, and the guard after the deletions proves none remain.
  statement(db, "INSERT INTO audit SELECT ?,?,'retention_gap',json_object('cutoff',?,'removed',(SELECT COUNT(*) FROM events WHERE project=? AND received<?),'dedupHorizon',?),?", auditId, project, cutoff, project, cutoff, cutoff, Date.now()),
  ...retentionAlertStatements(db,project,cutoff,Date.now()),
  ...feedbackJobs,
  ...commitRetentionStatements(db,project,cutoff,Date.now()),
  ...eventJobs,
  statement(db, 'UPDATE issues SET count=(SELECT COUNT(*) FROM events WHERE project=issues.project AND issue=issues.id),title=?,revision=revision+1 WHERE project=?', RETAINED_HEADLINE, project),
  guard(db, 'NOT EXISTS(SELECT 1 FROM events WHERE project=? AND received<?)', project, cutoff),
  ...headlines, ...mapJobs, ...exposureJobs,
  db.prepare('UPDATE rer_portability_state SET epoch=epoch+1 WHERE id=1'),
  db.prepare('INSERT INTO rer_portability_epochs SELECT source_identity,epoch FROM rer_portability_state WHERE id=1 ON CONFLICT(source) DO UPDATE SET epoch=MAX(epoch,excluded.epoch)'),
  statement(db, "SELECT json_extract(detail,'$.removed') AS removed FROM audit WHERE id=?", auditId),
  db.prepare('DELETE FROM rer_portability_guard'),
 ]);
 return (result[result.length - 2].results[0] as { removed: number }).removed;
}
