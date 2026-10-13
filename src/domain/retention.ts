import { tombstone } from '../modules/portability/journal.mjs';
import { state, statement, guard } from '../modules/portability/storage.mjs';
import { occurrenceKey, occurrenceKeys, type OccurrenceTable } from './occurrences';
import { portability } from './portability';
import { scrub } from './privacy';
import { retentionAlertStatements } from './alerts/spikes';

type Candidate = Record<string, string>;
const predicates = {
 events: 'received<?',
 artifacts: 'created<? AND NOT EXISTS(SELECT 1 FROM events WHERE events.project=artifacts.project AND events.release=artifacts.release AND events.build=artifacts.build)',
};
const transferInventory = "SELECT json_group_array(name) AS inventory FROM (SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'rer_portability_snap_*' OR name GLOB 'rer_portability_stage_*') ORDER BY name)";
async function erase(db: D1Database, source: string, table: OccurrenceTable, rows: Candidate[], project: string, cutoff: number, auditId: string) {
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
   // Alerts copy the issue headline, including regressions and spikes admitted
   // after the cutoff. They have no headline occurrence identity, so retain the
   // lifecycle/release chronology but withdraw that diagnostic text whenever
   // any of its issue's evidence is erased. Substituting the surviving headline
   // would falsely attribute newer evidence to the historical alert.
   statement(db, `UPDATE alerts SET payload=json_set(payload,'$.title','[headline unavailable after retention]')
    WHERE project=? AND payload IS NOT NULL AND issue IN (
     SELECT events.issue FROM events WHERE ${eligible} AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE ${match})
    )`,project,project,cutoff,encoded),
   statement(db, `DELETE FROM sentry_import_targets WHERE kind='event' AND EXISTS(SELECT 1 FROM events WHERE ${eligible} AND sentry_import_targets.id=json_array(events.project,events.id) AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE ${match}))`,project,cutoff,encoded));
  jobs.push(statement(db, `DELETE FROM ${table} WHERE ${eligible} AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE ${match})`, project, cutoff, encoded));
  if (table === 'events') jobs.push(statement(db, "UPDATE audit SET detail=json_set(detail,'$.removed',json_extract(detail,'$.removed')+changes()) WHERE id=?", auditId));
 }
 return jobs;
}

export async function applyRetention(db: D1Database, project: string, cutoff: number) {
 const transfer = await portability(db), before = await state(db), auditId = crypto.randomUUID();
 const events = (await statement(db, 'SELECT project,id,occurrence FROM events WHERE project=? AND received<?', project, cutoff).all()).results as Candidate[];
 const maps = (await statement(db, 'SELECT project,release,build,debug,occurrence FROM artifacts WHERE project=? AND created<?', project, cutoff).all()).results as Candidate[];
 const retained = (await statement(db, 'SELECT e.id,e.occurrence,e.issue,e.payload FROM events e WHERE e.project=? AND e.received>=? AND e.id=(SELECT id FROM events WHERE project=e.project AND issue=e.issue AND received>=? ORDER BY received,id LIMIT 1)', project, cutoff, cutoff).all()).results as any[];
 const headlines = retained.map(row => { const event = JSON.parse(row.payload); return statement(db, 'UPDATE issues SET title=? WHERE project=? AND id=? AND EXISTS(SELECT 1 FROM events WHERE project=? AND id=? AND occurrence=?)', scrub(event.type + ': ' + event.message), project, row.issue, project, row.id, row.occurrence); });
 const copies = await db.prepare(transferInventory).first<{ inventory: string }>();
 const invalidation = await transfer.invalidateTransfersStatements();
 const eventJobs = await erase(db, before.source_identity, 'events', events, project, cutoff, auditId);
 const mapJobs = await erase(db, before.source_identity, 'artifacts', maps, project, cutoff, auditId);
 // The source/epoch guard rejects a competing restore or retention. Each journal
 // INSERT and DELETE uses the same occurrence and predicate inside this batch.
 // A concurrently admitted map reference therefore preserves both map and fence.
 const result = await db.batch([
  guard(db, 'EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NULL AND source_identity=? AND epoch=?)', before.source_identity, before.epoch),
  // A newly created export must not leave an unlisted snapshot holding erased
  // rows. If transfer custody changed after discovery, the whole apply retries.
  guard(db, `(${transferInventory})=?`, copies!.inventory),
  ...invalidation,
  statement(db, "INSERT INTO audit VALUES(?,?,'retention_gap',?,?)", auditId, project, JSON.stringify({ cutoff, removed: 0, dedupHorizon: cutoff }), Date.now()),
  ...retentionAlertStatements(db,project,cutoff,Date.now()),
  ...eventJobs,
  statement(db, "UPDATE issues SET count=(SELECT COUNT(*) FROM events WHERE issue=issues.id),title='[headline unavailable after retention]',revision=revision+1 WHERE project=?", project),
  ...headlines, ...mapJobs,
  db.prepare('UPDATE rer_portability_state SET epoch=epoch+1 WHERE id=1'),
  db.prepare('INSERT INTO rer_portability_epochs SELECT source_identity,epoch FROM rer_portability_state WHERE id=1 ON CONFLICT(source) DO UPDATE SET epoch=MAX(epoch,excluded.epoch)'),
  statement(db, "SELECT json_extract(detail,'$.removed') AS removed FROM audit WHERE id=?", auditId),
  db.prepare('DELETE FROM rer_portability_guard'),
 ]);
 return (result[result.length - 2].results[0] as { removed: number }).removed;
}
