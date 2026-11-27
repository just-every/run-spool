// Measured recovery is computed from stored events, releases, maps, counters and
// retention records. It is never declared by a person or a model.
import { repairEvidence, type RepairEvidenceRow, type RepairObservationInput } from './evidence';
export { LOSS_REASONS } from './evidence';
export const VERDICT_LIMITS = 'This verdict does not show users who never reached the affected flow, failures lost in the client before transport, or the same failure grouped differently after a rebuild.';
const CLIENT_LOSS = { code: 'client_loss_unknown', reason: 'Unreported loss in the client before transport remains unknown.' };
type Reason = { code: string; reason: string };
export type Observation = {
 verdict: 'recurred' | 'inconclusive' | 'no_recurrence_after_exercise';
 reasons: Reason[];
 evidence: {
  release: { name: string; sequence: number; build: string; registered: number } | null;
  window: { start: number; end: number } | null;
  recurrence: { count: number; events: any[] };
  olderReleaseEvents: { count: number; events: any[]; counted: false };
  releaseEvents: number;
  mapStored: boolean;
  loss: { reason: string; count: number }[];
 };
 limits: string;
};

export async function observe(db: D1Database, repair: RepairObservationInput, now = Date.now()): Promise<Observation> {
 const row = repair.deployed_release === null ? null : await repairEvidence(db, repair).first<RepairEvidenceRow>();
 return observation(repair, row ?? undefined, now);
}

export function observation(repair: RepairObservationInput, row: RepairEvidenceRow | undefined, now: number): Observation {
 const empty = { release: null, window: null, recurrence: { count: 0, events: [] }, olderReleaseEvents: { count: 0, events: [], counted: false as const }, releaseEvents: 0, mapStored: false, loss: [] };
 if (repair.deployed_release === null) return { verdict: 'inconclusive', limits: VERDICT_LIMITS, evidence: empty,
  reasons: [{ code: 'not_deployed', reason: 'The repair is not marked deployed in a registered release.' }, CLIENT_LOSS] };
 if (!row) throw new Error('Deployed repair release not found');
 const { name, seq, build, registered: start } = row;
 const evidence: Observation['evidence'] = {
  release: { name, sequence: seq, build, registered: start }, window: { start, end: now },
  recurrence: { count: row.recurrence_count, events: JSON.parse(row.recurrence_events) },
  olderReleaseEvents: { count: row.older_count, events: JSON.parse(row.older_events), counted: false },
  releaseEvents: row.release_events, mapStored: !!row.map_stored, loss: JSON.parse(row.loss),
 };
 const reasons: Reason[] = row.grouping_changed ? [{ code: 'grouping_changed', reason: 'Operator corrections or project grouping policy changes affect this group, including any later undo. Retained admission and repair-associated occurrences still count; future default grouping does not establish coverage of the corrected group.' }] : [];
 if (evidence.recurrence.count) return { verdict: 'recurred', reasons: [{ code: 'recurred', reason: `A retained occurrence associated with this group at admission, currently, or during this repair arrived in release ${name} (sequence ${seq}) or a later registered release after ${name} was registered.` }, ...reasons], evidence, limits: VERDICT_LIMITS };
 if (!evidence.releaseEvents) reasons.push({ code: 'no_capture_from_release', reason: `No event at all has arrived from release ${name}, so capture is not shown to be wired for it.` });
 if (repair.exercised === null) reasons.push({ code: 'flow_not_exercised', reason: `No one has recorded that the affected flow was exercised in release ${name} after the deploy.` });
 if (!evidence.mapStored) reasons.push({ code: 'map_missing', reason: `No source map is stored for release ${name} and build ${build}, so its frames stay unmapped.` });
 if (evidence.loss.length) reasons.push({ code: 'windowed_loss', reason: `Capture counters record server refusals or SDK-discarded errors since release ${name} was registered (${evidence.loss.map(row => `${row.reason} ${row.count}`).join(', ')}).` });
 if (row.retention_gap) reasons.push({ code: 'retention_in_window', reason: `Retention removed events received after release ${name} was registered, so the window is incomplete.` });
 if (!reasons.length) return { verdict: 'no_recurrence_after_exercise', reasons: [{ code: 'no_recurrence_after_exercise', reason: `The affected flow was recorded as exercised in release ${name} after the deploy, capture from that release is shown, capture counters show no loss, and the group has not recurred.` }], evidence, limits: VERDICT_LIMITS };
 return { verdict: 'inconclusive', reasons: [...reasons, CLIENT_LOSS], evidence, limits: VERDICT_LIMITS };
}
