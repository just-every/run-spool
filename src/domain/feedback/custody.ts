import { erasureStatements, tombstone } from '../../modules/portability/journal.mjs';
import { guard, state, statement as s } from '../../modules/portability/storage.mjs';
import { portability } from '../portability';

const transferInventory = "SELECT json_group_array(name) AS inventory FROM (SELECT name FROM sqlite_master WHERE type='table' AND (name GLOB 'rer_portability_snap_*' OR name GLOB 'rer_portability_stage_*') ORDER BY name)";

/** The caller commits these with its current owner fence. A downloaded archive
 * cannot be recalled; its old row is refused here or with the later journal. */
export async function withdrawalStatements(db: D1Database, project: string, id: string, digest: string) {
 const transfer = await portability(db), before = await state(db);
 const copies = await db.prepare(transferInventory).first<{ inventory: string }>();
 return [
  guard(db, 'EXISTS(SELECT 1 FROM rer_portability_state WHERE id=1 AND import_job IS NULL AND source_identity=? AND epoch=?)', before.source_identity, before.epoch),
  guard(db, `(${transferInventory})=?`, copies!.inventory),
  guard(db, 'EXISTS(SELECT 1 FROM feedback WHERE project=? AND id=? AND digest=?)', project, id, digest),
  ...await transfer.invalidateTransfersStatements(),
  ...await erasureStatements(db, 'feedback', { project, id }),
  s(db, 'DELETE FROM feedback WHERE project=? AND id=?', project, id),
  s(db, "INSERT INTO audit VALUES(?,?,'feedback_withdrawn',?,?)", crypto.randomUUID(), project, JSON.stringify({ count: 1 }), Date.now()),
  db.prepare('DELETE FROM rer_portability_guard'),
 ];
}

// Delete before an event cascade, so every removed report gets its own key
// fence as well as the event's occurrence fence. Standalone reports use cutoff.
const baseEligible = `project=? AND (received<? OR EXISTS(SELECT 1 FROM events e WHERE e.project=feedback.project AND e.id=feedback.event_id AND e.occurrence=feedback.occurrence AND e.received<?))`;
export async function feedbackRetentionStatements(db: D1Database, source: string, project: string, cutoff: number, eventCutoff=cutoff, selected?:string, limit?:number) {
 let eligible=selected?baseEligible.replace('e.received<?',"e.received<? AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE e.id=json_extract(candidate.value,'$.id') AND e.occurrence=json_extract(candidate.value,'$.occurrence'))"):baseEligible;
 const values:any[]=selected?[project,cutoff,eventCutoff,selected]:[project,cutoff,eventCutoff];
 if(limit&&selected){
  eligible+=` AND (id IN (SELECT id FROM feedback WHERE project=? AND received<? ORDER BY received,id LIMIT ?) OR EXISTS(SELECT 1 FROM events e WHERE e.project=feedback.project AND e.id=feedback.event_id AND e.occurrence=feedback.occurrence AND EXISTS(SELECT 1 FROM json_each(?) candidate WHERE e.id=json_extract(candidate.value,'$.id') AND e.occurrence=json_extract(candidate.value,'$.occurrence'))))`;
  values.push(project,cutoff,limit,selected);
 }
 const rows = (await s(db, `SELECT id FROM feedback WHERE ${eligible} ORDER BY received,id LIMIT ?`, ...values, 10000).all()).results as { id: string }[];
 // A new report can bind an old event between discovery and the retention
 // batch. Refuse that stale plan rather than leaving an orphaned description.
 const jobs: D1PreparedStatement[] = [guard(db, `(SELECT COUNT(*) FROM feedback WHERE ${eligible})=?`, ...values, rows.length)];
 for (let offset = 0; offset < rows.length; offset += 50) {
  const candidates = await Promise.all(rows.slice(offset, offset + 50).map(async row => ({ id: row.id, tombstone: await tombstone(source, 'feedback', { project, id: row.id }) })));
  const encoded = JSON.stringify(candidates);
  jobs.push(s(db, `INSERT OR IGNORE INTO rer_portability_journal SELECT ?,json_extract(candidate.value,'$.tombstone') FROM json_each(?) candidate WHERE EXISTS(SELECT 1 FROM feedback WHERE ${eligible} AND feedback.id=json_extract(candidate.value,'$.id'))`, source, encoded, ...values));
  jobs.push(s(db, `DELETE FROM feedback WHERE ${eligible} AND id IN (SELECT json_extract(value,'$.id') FROM json_each(?))`, ...values, encoded));
 }
 return jobs;
}
