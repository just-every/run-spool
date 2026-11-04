import { ensureShortIds } from '../short-ids/assign';
import { primaryShortIdSql } from '../short-ids/lookup';

/** Presentation stays outside the immutable correction plan and its revision guards. */
export async function correctionDisplay(db: D1Database, project: string, issues: string[], events: string[]) {
  await ensureShortIds(db, project);
  const [issueRows, eventRows] = await Promise.all([
    db.prepare(`SELECT i.id,${primaryShortIdSql('i')} short_id,i.title FROM issues i WHERE i.project=? AND i.id IN (SELECT value FROM json_each(?))`).bind(project, JSON.stringify(issues)).all<{id: string; short_id: string; title: string}>(),
    db.prepare('SELECT id,received,payload FROM events WHERE project=? AND id IN (SELECT value FROM json_each(?))').bind(project, JSON.stringify(events)).all<{id: string; received: number; payload: string}>()
  ]);
  return {
    issues: issueRows.results,
    events: eventRows.results.map(row => { const event = JSON.parse(row.payload); return { id: row.id, received: row.received, type: event.type, message: event.message }; })
  };
}
