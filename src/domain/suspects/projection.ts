import { number, text, suspectJudgmentProjection } from '../agent-projection';
import { suspectCandidates } from './read';

// Nested bounds leave space for ordinary event evidence within the whole packet cap.
const CANDIDATE_LIMIT = 20, REASON_LIMIT = 5, DEPLOYMENT_LIMIT = 5;
export async function packetSuspects(db: D1Database, project: string, issue: string) {
 const selected = await suspectCandidates(db, project, issue);
 return {
  version: 1,
  candidates: selected.candidates.slice(0, CANDIDATE_LIMIT).map(row => ({
   release: text(row.release), sha: row.sha === null ? null : text(row.sha, 64),
   reason: row.reason.slice(0, REASON_LIMIT).map((basis: any) => ({ kind: basis.kind,
    record: basis.kind === 'first_retained_occurrence'
     ? { id: text(basis.record.id), occurrence: text(basis.record.occurrence), release: text(basis.record.release), environment: text(basis.record.environment), received: number(basis.record.received) }
     : { alertId: text(basis.record.alertId), received: number(basis.record.received), release: text(basis.record.release) } })),
   inclusion: { source: ['release', 'deployment', 'sha_release', 'retained_occurrence'].includes(row.inclusion.source) ? row.inclusion.source : 'unavailable', created: number(row.inclusion.created) },
   deployments: row.deployments.slice(0, DEPLOYMENT_LIMIT).map((deployment: any) => ({ id: text(deployment.id), environment: text(deployment.environment), started: number(deployment.started), deadline: number(deployment.deadline), historical: deployment.historical === 1 })),
   judgment: suspectJudgmentProjection(row.decision),
   bounds: { reasonsAvailable: row.reason.length, reasonsIncluded: Math.min(row.reason.length, REASON_LIMIT), reasonLimit: REASON_LIMIT,
    deploymentsAvailable: row.bounds.deploymentsAvailable, deploymentsIncluded: Math.min(row.deployments.length, DEPLOYMENT_LIMIT), deploymentLimit: DEPLOYMENT_LIMIT },
   correlation: 'Correlation, not a demonstrated cause.',
   changedSource: { available: false, reason: 'Recorded commit receipts contain no changed-file list. Source matching is unavailable; no path or ancestry is inferred.' },
  })),
  bounds: { ...selected.bounds, candidateLimit: CANDIDATE_LIMIT, included: Math.min(selected.candidates.length, CANDIDATE_LIMIT) },
  provenance: 'Retained first occurrences, recorded regression alerts and engineer judgment states only. Private judgment notes, people, commit author and message, repository and source content are excluded. Historical deployments are inert records. No automatic action or demonstrated cause.',
  unavailable: selected.candidates.length ? null : 'No retained released occurrence or recorded released regression alert establishes a candidate.',
 };
}
