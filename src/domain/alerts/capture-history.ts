import { statement as s } from './types';

export const captureAuditKinds = ['capture_history_started', 'capture_unsuppressed'];
export const captureFact = (kind: string, issue: string) => `EXISTS(SELECT 1 FROM audit capture
 WHERE capture.project=i.project AND capture.kind='${kind}' AND json_extract(capture.detail,'$.issue')=${issue})`;

// Only a newly created issue proves that tracking covers its entire native
// lifetime. Old archives can lack these facts; missing retained rows do not
// establish that their deleted occurrences were all policy-suppressed.
export function startCaptureHistory(db: D1Database, project: string, issue: string, time: number) {
 return s(db, `INSERT INTO audit(id,project,kind,detail,created)
  SELECT ?,i.project,'capture_history_started',json_object('issue',i.id),?
  FROM issues i WHERE i.project=? AND i.id=? AND i.algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1') AND i.revision=0 AND i.count=0
   AND NOT ${captureFact('capture_history_started', 'i.id')}`, crypto.randomUUID(), time, project, issue);
}

// Written after alert selection, even when manual issue suppression prevented
// an alert. At most one payload-free fact survives per native issue; it retains
// no event ID, occurrence, release, message, policy value or diagnostic copy.
export function rememberUnsuppressedCapture(db: D1Database, project: string, issue: string, eventId: string, occurrence: string, time: number) {
 return s(db, `INSERT INTO audit(id,project,kind,detail,created)
  SELECT ?,i.project,'capture_unsuppressed',json_object('issue',i.id),?
  FROM issues i JOIN events e ON e.project=i.project AND e.issue=i.id
  WHERE i.project=? AND i.id=? AND i.algorithm IN ('js-frame-v1','python-frame-v1','go-frame-v1') AND e.id=? AND e.occurrence=? AND e.historical=0
   AND NOT EXISTS(SELECT 1 FROM event_suppressions receipt WHERE receipt.project=e.project AND receipt.event=e.id AND receipt.occurrence=e.occurrence)
   AND NOT ${captureFact('capture_unsuppressed', 'i.id')}`, crypto.randomUUID(), time, project, issue, eventId, occurrence);
}
