import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { IssuePanels } from './issuePanels';
import { attentionLabel, type Alert } from './attention';
import { hrefFor } from './location';
import { Icon } from './icons';
import { PageHeader } from './PageHeader';
import { StackTrace } from './StackTrace';
import { Breadcrumbs } from './Breadcrumbs';
import { EventExplorer } from './EventExplorer';
import { CheckInLink } from './CheckInLink';
import { IssueActions, IssueMore, IssueProperties } from './IssueRail';
import { Discussion, useDiscussion } from './Discussion';
import { CommitTimeline } from './CommitTimeline';
import { AffectedUsers } from './AffectedUsers';
import { SuspectChanges, useSuspects } from './SuspectChanges';
import { FeedbackPanel } from './FeedbackPanel';
import { ObservedDeployments, RecentOccurrence } from './IssueFacts';
import { OperatorDecisions, useOperator } from './OperatorPanel';
import { RepairPanel } from './RepairPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { stateLabel, type Request, type Run } from './shared';
import './issue.css';

type Props = {
  project: string; projectName: string; packet: any; panels: IssuePanels | null; status: string; alert?: Alert; outcomes: any; busy: boolean; request: Request; run: Run; refresh: () => void;
  onUpload: (release: string, debugId: string) => void; onViewed: (id: string) => void; readOnly?: boolean; manageProject?: boolean; manageOrganization?: boolean;
};
/** One issue: the evidence first (stack trace, breadcrumbs, events) beside a rail of Actions, Properties and More,
 * then each remaining section as one row that opens in place. At phone width the rail's parts interleave. */
export function IssueView({ project, projectName, packet, panels, status, alert, outcomes, busy, request, run, refresh, onUpload, onViewed, readOnly = false, manageProject = true, manageOrganization = true }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const group = packet?.issue;
  const [resolution, setResolution] = useState({ mode: 'plain', release: '' });
  useEffect(() => setSelectedEvent(null), [project, group?.id]);
  useEffect(() => { if (group?.state === 'resolved' && group.resolution_mode) setResolution({ mode: group.resolution_mode, release: group.resolution_release ?? '' }); }, [group?.id, group?.state]);
  useEffect(() => { if (packet && alert) onViewed(alert.id); }, [packet, alert?.id, onViewed]);
  const discussion = useDiscussion(project, group?.id, packet, request, refresh);
  const suspects = useSuspects(project, group?.id, request, !readOnly);
  const operator = useOperator({ project, packet, initial: panels?.operator, request, run, refresh, enabled: manageProject });
  const crumb = (key?: string) => <>{projectName} <span aria-hidden="true">/</span> <Link to={hrefFor(project) as any} aria-label="All issues">Issues</Link>{key && <><span aria-hidden="true">/</span> <code>{key}</code></>}</>;
  if (!packet) return <><PageHeader crumb={crumb()} title="Issue" record /><section className="evidence">{status === 'loading' ? <p role="status">Loading issue evidence…</p> : <><h2>Issue evidence unavailable</h2><p>The issue may have been removed, or its evidence could not be loaded.</p><button className="text-button" onClick={refresh}>Retry evidence</button></>}</section></>;
  const event = selectedEvent ?? packet.events?.[0], grouping = selectedEvent?.grouping ?? event?.originalGrouping;
  const steps: string[] = (event?.event.breadcrumbs ?? []).filter((step: unknown) => typeof step === 'string');
  const triage = (state: string) => void run(async () => { await request(`/api/projects/${project}/issues/${group.id}`, 'PATCH', { state, revision: group.revision, ...(state === 'resolved' ? { resolution: resolution.mode, ...(resolution.mode === 'named' ? { release: resolution.release } : {}) } : {}) }); refresh(); });
  const rail = { project, packet, outcomes, resolution, onResolution: setResolution, triage, operator, discussion, suspects, busy, request, run, refresh, readOnly, manageProject };
  return <div className="issue-page">
    <div className="issue-main">
      <PageHeader crumb={crumb(group.short_id ?? undefined)} title={group.title} record>
        <div className="issue-status chip-row">
          {group.short_id && <code className="short-id key-chip">{group.short_id}</code>}
          <span className={`state-chip ${group.state}`}>{stateLabel(group.state)}</span>
          {alert && <span className="pill attention-chip"><Icon name="flag" />{attentionLabel(alert)}</span>}
          <span className="meta">{group.count} events{event ? <> · <code>{event.event.release || 'none'}</code> · {event.event.environment}</> : ' · occurrence evidence deleted by retention'}</span>
        </div>
        {packet.shortIdRequest?.alias && <p className="callout" role="status">{packet.shortIdRequest.requested} is an alias of {group.short_id}: that issue was merged here, and every link to it opens this issue.</p>}
        {!!group.short_id_aliases?.length && <p className="meta short-id-aliases">Also answers to {group.short_id_aliases.join(', ')}.</p>}
        {group.short_id_resolves_to && <p className="callout">{group.short_id} now resolves to {group.short_id_resolves_to}, where these occurrences were merged.</p>}
        {!!group.seen_without_release && <p className="callout">{group.seen_without_release} seen with no release after resolve. Inspect these occurrences in Events with !has:release.</p>}
      </PageHeader>
      <div className="issue-evidence">
        <StackTrace packet={packet} event={event} grouping={grouping} readOnly={readOnly} onUpload={onUpload} />
        {steps.length > 0 && <Breadcrumbs steps={steps} />}
        <EventExplorer key={`${project}:${group.id}`} project={project} issue={group.id} refresh={packet} onSelect={setSelectedEvent}><CheckInLink checkIns={event?.checkIns} /></EventExplorer>
      </div>
      <div className="issue-tail">
        <Discussion discussion={discussion} />
        <CommitTimeline project={project} issue={group.id} shortId={group.short_id} refresh={packet} request={request} />
        <AffectedUsers project={project} issue={group.id} request={request} refresh={packet} />
        {!readOnly && <SuspectChanges suspects={suspects} {...{ request, run, busy }} />}
        {manageOrganization && <FeedbackPanel key={`${project}:${group.id}`} project={project} issue={group.id} {...{ request, run, busy }} />}
        <RecentOccurrence group={group} event={event} />
        <ObservedDeployments deployments={packet.deployments} />
        {manageProject && <OperatorDecisions operator={operator} packet={packet} {...{ busy, request, run, refresh }} />}
        {manageOrganization && <RepairPanel initial={panels?.repairs} project={project} issue={group} busy={busy} request={request} run={run} refresh={refresh} />}
        {manageOrganization && <ExecutionPanel initial={panels?.execution} project={project} issue={group} event={event} busy={busy} request={request} run={run} />}
      </div>
    </div>
    <div className="issue-rail">
      <IssueActions {...rail} />
      <IssueProperties {...rail} />
      <IssueMore {...rail} />
    </div>
  </div>;
}
