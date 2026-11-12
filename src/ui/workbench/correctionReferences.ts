import { eventReference, issueReference, actorReference } from './references';
import { hrefFor } from './location';
import type { Request } from './shared';
import type { CorrectionLabels } from './OperatorPanel';

export async function loadCorrectionReferences(root: string, packet: any, history: any[], request: Request) {
  const [issues, controls] = await Promise.all([request(`${root}/issues`), request(`${root}/alerting/controls`)]);
  const events = [...packet.events];
  // Resolve moved occurrences from their current issue as well as their recorded source.
  const ids = [...new Set<string>(history.flatMap(entry => entry.plan.moves.flatMap((move: any) => [move.from, move.to])))];
  const missing = ids.filter(id => id !== packet.issue.id && (!issues.some((issue: any) => issue.id === id) || history.some(entry => entry.plan.moves.some((move: any) =>
    (move.from === id || move.to === id) && !events.some(event => event.id === move.event && event.occurrence === move.occurrence)))));
  for (const result of await Promise.allSettled(missing.map(id => request(`${root}/issues/${encodeURIComponent(id)}/packet`)))) {
    if (result.status === 'rejected') { if (result.reason?.status !== 404) throw result.reason; continue; }
    issues.push(result.value.issue); events.push(...result.value.events);
  }
  return { issues: [packet.issue, ...issues], events, timeZone: controls.settings.timezone };
}
export function correctionLabels(project: string, packet: any, references: any, preview: any, audit: any[]): CorrectionLabels {
  const issues = references?.issues ?? [packet.issue], events = [...packet.events, ...(references?.events ?? [])];
  const event = (id: string, occurrence?: string) => events.find(row => row.id === id && (!occurrence || row.occurrence === occurrence));
  return {
    timeZone: references?.timeZone,
    issue: id => issueReference(issues.find((row: any) => row.id === id) ?? (preview?.newIssue?.id === id ? { title: `New issue · ${packet.issue.title} (short ID assigned on apply)` } : null)),
    event: (id, occurrence) => eventReference(event(id, occurrence), references?.timeZone),
    issueHref: id => issues.some((row: any) => row.id === id) ? hrefFor(project, 'issues', id) : undefined,
    eventHref: (id, occurrence) => { const row = event(id, occurrence); return row ? `${hrefFor(project, 'issues', row.currentGrouping?.issue ?? row.issue ?? packet.issue.id)}?${new URLSearchParams({ event: id, occurrence: row.occurrence })}` : undefined; },
    actor: entry => {
      const row = audit.find(row => { const detail = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail; return detail.correction === entry.id && row.kind === (entry.state === 'undone' ? 'grouping_undone' : 'grouping_applied'); });
      return actorReference(row?.preparedBy ? { kind: 'agent', name: row.preparedBy.label } : row?.personActor ? { kind: 'member', name: row.personActor.person?.name ?? row.personActor.label } : null);
    }
  };
}
