import { correctionMembership, originalMembership } from '../operators/provenance';

export const LOSS_REASONS = ['unauthorized', 'invalid', 'oversized', 'rejected', 'rate_limited','key_rate_limited', 'budget', 'storage_failure', 'unregistered_release_or_build', 'missing_release_register_required'];
const EVIDENCE_LIMIT = 10;
const columns = 'id,project,issue,created,deployed_release';
export type RepairObservationInput = {
 id: string;
 project: string;
 issue: string;
 created: number;
 deployed_release: string | null;
 exercised: number | null;
};
export type RepairEvidenceRow = {
 id: string;
 name: string;
 seq: number;
 build: string;
 registered: number;
 recurrence_count: number;
 recurrence_events: string;
 older_count: number;
 older_events: string;
 release_events: number;
 map_stored: number;
 loss: string;
 retention_gap: number;
 grouping_changed: number;
};

function eventEvidence(name: 'recurrence' | 'older', sequence: '>=' | '<') {
 // Keep admission and repair-lifetime membership, even after corrections move an occurrence.
 const matching = `FROM events e WHERE e.project=r.project
  AND (e.issue=r.issue OR ${originalMembership('e', 'r.issue')} OR ${correctionMembership('e', 'r.issue', 'r.created')})
  AND e.historical=0 AND e.received>=l.created AND e.release_seq${sequence}l.seq`;
 return `(SELECT COUNT(*) ${matching}) AS ${name}_count,
  (SELECT json_group_array(json_object('id',id,'release',release,'sequence',release_seq,'received',received))
   FROM (SELECT e.id,e.release,e.release_seq,e.received ${matching} ORDER BY e.received,e.id LIMIT ${EVIDENCE_LIMIT})) AS ${name}_events`;
}

function evidence(db: D1Database, selection: string, ...bindings: (string | number | null)[]) {
 const minute = 'CAST(l.created/60000.0 AS INTEGER)*60000';
 return db.prepare(`WITH selected(${columns}) AS (${selection})
  SELECT r.id,l.name,l.seq,l.build,l.created AS registered,
   ${eventEvidence('recurrence', '>=')},
   ${eventEvidence('older', '<')},
   (SELECT COUNT(*) FROM events WHERE project=r.project AND release=l.name AND historical=0) AS release_events,
   EXISTS(SELECT 1 FROM artifacts WHERE project=r.project AND release=l.name AND build=l.build) AS map_stored,
   (SELECT json_group_array(json_object('reason',reason,'count',count)) FROM (
    SELECT reason,SUM(count) AS count FROM outcomes WHERE project=r.project
     AND window>=${minute}-CASE WHEN l.created<${minute} THEN 60000 ELSE 0 END
     AND (reason IN (${LOSS_REASONS.map(() => '?').join(',')}) OR reason GLOB 'client_discarded:error:*')
    GROUP BY reason ORDER BY reason)) AS loss,
   EXISTS(SELECT 1 FROM audit WHERE project=r.project AND kind='retention_gap' AND json_extract(detail,'$.cutoff')>l.created) AS retention_gap,
   (EXISTS(SELECT 1 FROM grouping_corrections c,json_each(c.plan,'$.moves') m WHERE c.project=r.project AND c.state IN ('applied','undone')
     AND r.issue IN (json_extract(m.value,'$.from'),json_extract(m.value,'$.to')))
    OR EXISTS(SELECT 1 FROM audit WHERE project=r.project AND kind='grouping_rules_changed' AND created>=r.created)) AS grouping_changed
  FROM selected r JOIN releases l ON l.project=r.project AND l.name=r.deployed_release`).bind(...bindings, ...LOSS_REASONS);
}

export function repairEvidence(db: D1Database, repair: RepairObservationInput) {
 return evidence(db, 'VALUES (?,?,?,?,?)', repair.id, repair.project, repair.issue, repair.created, repair.deployed_release);
}

export function proposalRepairReads(db: D1Database, project: string, issueIds: string) {
 const scope = 'FROM repairs WHERE project=? AND issue IN (SELECT value FROM json_each(?))';
 return [
  db.prepare(`SELECT ${columns},exercised ${scope} ORDER BY created,id`).bind(project, issueIds),
  evidence(db, `SELECT ${columns} ${scope}`, project, issueIds),
  db.prepare(`SELECT created,kind FROM audit WHERE project=? AND kind IN ('grouping_applied','grouping_undone')
   AND created >= (SELECT MIN(created) ${scope}) ORDER BY created,id`).bind(project, project, issueIds),
 ];
}
