import { scrub } from '../privacy';
import { s } from './common';

// The correction's revision/count/occurrence guards fence these reads. A split
// must derive its headline from the moved evidence, not copy its parent's text.
export async function correctionHeadlines(db: D1Database, project: string, issues: string[], moves: { event: string; occurrence: string; from: string; to: string }[], undo: boolean) {
 const rows = await Promise.all(issues.map(async issue => {
  const event = await s(db, `SELECT e.payload FROM events e WHERE e.project=? AND
   COALESCE((SELECT json_extract(m.value,?) FROM json_each(?) m
    WHERE json_extract(m.value,'$.event')=e.id AND json_extract(m.value,'$.occurrence')=e.occurrence),e.issue)=?
   ORDER BY e.received,e.id LIMIT 1`, project, undo ? '$.from' : '$.to', JSON.stringify(moves), issue).first<any>();
  const payload = event ? JSON.parse(event.payload) : null;
  return [issue, payload ? scrub(payload.type + ': ' + payload.message) : '[no retained occurrences]'] as const;
 }));
 return new Map(rows);
}
