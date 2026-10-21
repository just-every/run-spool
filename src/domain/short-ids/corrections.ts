import { assignShortId } from './assign';

const s = (db: D1Database, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args);
type Plan = { kind: 'split' | 'merge'; issues: { id: string }[]; target: string };
/** Merge: every ID resolving to the absorbed issue resolves to the survivor. Split:
 * the original keeps its ID and the split-out issue takes the next number. Undo
 * restores the recorded mapping; a split-out ID then resolves to the original,
 * where its occurrences returned, and is never reused. */
export function shortIdCorrection(db: D1Database, project: string, correction: string, plan: Plan, undo: boolean, time: number) {
 const source = plan.issues[0].id, target = plan.target;
 if (plan.kind === 'split') return undo ? [
  s(db, "INSERT INTO issue_short_id_moves(project,correction,short_id,direction,from_issue,to_issue,created) SELECT project,?,short_id,'undo',issue,?,? FROM issue_short_ids WHERE project=? AND issue=?", correction, source, time, project, target),
  s(db, 'UPDATE issue_short_ids SET issue=? WHERE project=? AND issue=?', source, project, target),
 ] : assignShortId(db, project, target, time);
 return undo ? [
  s(db, "INSERT INTO issue_short_id_moves(project,correction,short_id,direction,from_issue,to_issue,created) SELECT project,correction,short_id,'undo',to_issue,from_issue,? FROM issue_short_id_moves WHERE correction=? AND direction='apply'", time, correction),
  s(db, "UPDATE issue_short_ids SET issue=(SELECT from_issue FROM issue_short_id_moves m WHERE m.correction=? AND m.direction='apply' AND m.short_id=issue_short_ids.short_id) WHERE project=? AND short_id IN (SELECT short_id FROM issue_short_id_moves WHERE correction=? AND direction='apply')", correction, project, correction),
 ] : [
  s(db, "INSERT INTO issue_short_id_moves(project,correction,short_id,direction,from_issue,to_issue,created) SELECT project,?,short_id,'apply',issue,?,? FROM issue_short_ids WHERE project=? AND issue=?", correction, target, time, project, source),
  s(db, 'UPDATE issue_short_ids SET issue=? WHERE project=? AND issue=?', target, project, source),
 ];
}
