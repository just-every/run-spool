import {AuthError} from '../modules/operator-auth/index.mjs';
import {readRetentionPolicy,retentionPolicyFence,type RetentionWindows} from './retention-policy';
import { tombstone, invalidateTransfersStatements } from '../modules/portability/journal.mjs';
import { state, statement, guard } from '../modules/portability/storage.mjs';
import { occurrenceKey, occurrenceKeys, type OccurrenceTable } from './occurrences';
import { scrub } from './privacy';
import { retentionAlertStatements } from './alerts/spikes';
import { withdrawAlertEvidence, RETAINED_HEADLINE } from './alerts/retention';
import { retentionExposureStatements } from './exposure/retention';
import { feedbackRetentionStatements } from './feedback/custody';
import { commitRetentionStatements } from './commits/retention';

type Candidate = Record<string, string>;
// A batch names its rows by primary key: (project,id,occurrence) lookups, never a scan of the project.
export const selectedEvents = "(id,occurrence) IN (SELECT json_extract(value,'$.id'),json_extract(value,'$.occurrence') FROM json_each(?))";
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
  if(table==='events'){jobs.push(
   ...withdrawAlertEvidence(db, project, cutoff, encoded, Date.now()),
   statement(db, `DELETE FROM sentry_import_targets WHERE kind='event' AND id IN (SELECT json_array(events.project,events.id) FROM events WHERE ${eligible} AND ${selectedEvents})`,project,cutoff,encoded),
   statement(db, `DELETE FROM events WHERE ${eligible} AND ${selectedEvents}`, project, cutoff, encoded));continue}
  jobs.push(statement(db, `DELETE FROM ${table} WHERE ${eligible} AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE ${match})`, project, cutoff, encoded));
 }
 return jobs;
}

export async function applyRetention(db: D1Database, project: string, cutoff: number, cutoffs?: RetentionWindows, limit?: number) {
 const policy=await readRetentionPolicy(db,project);
 if(policy.held)throw new AuthError('Retention is paused by a legal hold',409);
 const windows=cutoffs??{events:cutoff,artifacts:cutoff,feedback:cutoff,exposures:cutoff,commits:cutoff,sessions:cutoff};
 const before = await state(db), auditId = crypto.randomUUID();
 // The oldest events first, so every event a batch keeps sorts after its last one.
 const rows = (await statement(db, 'SELECT project,id,occurrence,issue,received FROM events WHERE project=? AND received<? ORDER BY received,id LIMIT ?', project, cutoff, limit??10000).all()).results as any[];
 const events = rows.map(({project,id,occurrence}) => ({project,id,occurrence})) as Candidate[];
 const selected=JSON.stringify(events),placed=limit?JSON.stringify(rows.map(({id,occurrence,issue})=>({id,occurrence,issue}))):'';
 const removedBy:Record<string,number>={};for(const row of rows)removedBy[row.issue]=(removedBy[row.issue]??0)+1;
 const selectedMatch="(events.id,events.occurrence) IN (SELECT json_extract(value,'$.id'),json_extract(value,'$.occurrence') FROM json_each(?))";
 const maps = (await statement(db, 'SELECT project,release,build,debug,occurrence FROM artifacts WHERE project=? AND created<?', project, limit?0:windows.artifacts).all()).results as Candidate[];
 // Only issues that lose an event change: each keeps its count less the removed events and
 // takes its headline from its earliest kept event, found by its (project,issue,received,id) index.
 const last = rows.at(-1), affected = [...new Set(rows.map(row => row.issue as string))];
 const firsts = last ? (await statement(db, `SELECT a.value issue,(SELECT json_array(e.id,e.occurrence,e.payload) FROM events e WHERE e.project=? AND e.issue=a.value AND (e.received,e.id)>(?,?) ORDER BY e.received,e.id LIMIT 1) first FROM json_each(?) a`, project, last.received, last.id, JSON.stringify(affected)).all()).results as { issue: string; first: string | null }[] : [];
 // Resolve membership in the write transaction: a correction can move a
 // retained headline after this read. Never reattach its text to its old issue.
 const headlines: D1PreparedStatement[] = [];
 const kept = firsts.flatMap(row => { if (!row.first) return []; const [id, occurrence, payload] = JSON.parse(row.first), event = JSON.parse(payload); return [{ id, occurrence, title: scrub(event.type + ': ' + event.message) }]; });
 for (let offset = 0; offset < kept.length; offset += 50) {
  headlines.push(statement(db, `WITH headlines AS (
   SELECT e.issue,json_extract(candidate.value,'$.title') title FROM json_each(?) candidate CROSS JOIN events e
   WHERE e.project=? AND e.id=json_extract(candidate.value,'$.id') AND e.occurrence=json_extract(candidate.value,'$.occurrence')
    AND e.id=(SELECT id FROM events WHERE project=e.project AND issue=e.issue ORDER BY received,id LIMIT 1)
  ) UPDATE issues SET title=(SELECT title FROM headlines WHERE issue=issues.id) WHERE project=? AND id IN (SELECT issue FROM headlines)`, JSON.stringify(kept.slice(offset, offset + 50)), project, project));
 }
 const copies = await db.prepare(transferInventory).first<{ inventory: string }>();
 const invalidation = await invalidateTransfersStatements(db);
 const eventJobs = await erase(db, before.source_identity, 'events', events, project, cutoff);
 const mapJobs = await erase(db, before.source_identity, 'artifacts', maps, project, windows.artifacts);
 const exposureJobs = await retentionExposureStatements(db, before.source_identity, project, windows.exposures, Date.now(), limit);
 const feedbackJobs = await feedbackRetentionStatements(db, before.source_identity, project, windows.feedback, cutoff, limit?selected:undefined, limit);
 // The source/epoch guard rejects a competing restore or retention. Each journal
 // INSERT and DELETE uses the same occurrence and predicate inside this batch.
 // A concurrently admitted map reference therefore preserves both map and fence.
 const sessionFence=await tombstone(before.source_identity,'rer_portability_state',{id:1});
 const result = await db.batch([
  retentionPolicyFence(db,project,policy.generation),
  guard(db,'NOT EXISTS(SELECT 1 FROM retention_policies WHERE project=? AND held=1)',project),
  guard(db, 'EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NULL AND source_identity=? AND epoch=?)', before.source_identity, before.epoch),
  // A newly created export must not leave an unlisted snapshot holding erased
  // rows. If transfer custody changed after discovery, the whole apply retries.
  guard(db, `(${transferInventory})=?`, copies!.inventory),
  ...invalidation,
  // A scheduled batch's events are all still there, each in the issue it was read from.
  ...(limit?[guard(db,`(SELECT COUNT(*) FROM events WHERE project=? AND received<? AND (events.id,events.occurrence,events.issue) IN (SELECT json_extract(value,'$.id'),json_extract(value,'$.occurrence'),json_extract(value,'$.issue') FROM json_each(?)))=?`,project,cutoff,placed,events.length)]:[]),
  // The journal row is written once and never revised: it counts the events
  // this batch removes, and the guard after the deletions proves none remain.
  statement(db, "INSERT INTO audit SELECT ?,?,'retention_gap',json_object('cutoff',?,'removed',?,'dedupHorizon',?),?", auditId, project, cutoff, events.length, cutoff, Date.now()),
  ...retentionAlertStatements(db,project,cutoff,Date.now()),
  ...feedbackJobs,
  ...commitRetentionStatements(db,project,windows.commits,Date.now(),limit),
  ...eventJobs,
  limit?statement(db, `UPDATE issues SET count=MAX(0,count-COALESCE(json_extract(?,'$."'||issues.id||'"'),0)),title=?,revision=revision+1
   WHERE project=? AND id IN (SELECT value FROM json_each(?))`, JSON.stringify(removedBy), RETAINED_HEADLINE, project, JSON.stringify(affected))
   :statement(db, 'UPDATE issues SET count=(SELECT COUNT(*) FROM events WHERE project=issues.project AND issue=issues.id),title=?,revision=revision+1 WHERE project=? AND id IN (SELECT value FROM json_each(?))', RETAINED_HEADLINE, project, JSON.stringify(affected)),
  limit?guard(db,`NOT EXISTS(SELECT 1 FROM events WHERE project=? AND ${selectedMatch})`,project,selected):guard(db, 'NOT EXISTS(SELECT 1 FROM events WHERE project=? AND received<?)', project, cutoff),
  ...headlines, ...mapJobs, ...exposureJobs,
  statement(db,'INSERT OR IGNORE INTO rer_portability_journal SELECT ?,? WHERE EXISTS(SELECT 1 FROM health_sessions WHERE project=? AND updated<?)',before.source_identity,sessionFence,project,windows.sessions),
  statement(db,'DELETE FROM health_sessions WHERE rowid IN (SELECT rowid FROM health_sessions WHERE project=? AND updated<? ORDER BY updated,sid LIMIT ?)',project,windows.sessions,limit??50000),
  db.prepare('UPDATE rer_portability_state SET epoch=epoch+1 WHERE id=1'),
  db.prepare('INSERT INTO rer_portability_epochs SELECT source_identity,epoch FROM rer_portability_state WHERE id=1 ON CONFLICT(source) DO UPDATE SET epoch=MAX(epoch,excluded.epoch)'),
  statement(db, "SELECT json_extract(detail,'$.removed') AS removed FROM audit WHERE id=?", auditId),
  db.prepare('DELETE FROM rer_portability_guard'),
 ]);
 return (result[result.length - 2].results[0] as { removed: number }).removed;
}
