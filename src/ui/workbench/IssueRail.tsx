import { useId, useState } from 'react';
import { Details } from './Details';
import { Icon } from './icons';
import { Priority } from './Priority';
import { ResolutionPicker } from './ResolutionPicker';
import { Suppression } from './Suppression';
import { CaptureReceipts } from './CaptureReceipts';
import { AssignmentControl, type useOperator } from './OperatorPanel';
import type { useDiscussion } from './Discussion';
import type { useSuspects } from './SuspectChanges';
import { hrefFor } from './location';
import { download, shortDay, stateLabel, states, type Request, type Run } from './shared';

type Resolution = { mode: string; release: string };
type Props = {
  project: string; packet: any; outcomes: any; resolution: Resolution; onResolution: (value: Resolution) => void; triage: (state: string) => void;
  operator: ReturnType<typeof useOperator>; discussion: ReturnType<typeof useDiscussion>; suspects: ReturnType<typeof useSuspects>;
  busy: boolean; request: Request; run: Run; refresh: () => void; readOnly: boolean; manageProject: boolean;
};

/** The issue's rail: Actions in one box, Properties as an unboxed list of click-to-edit values, then More. */
export function IssueActions({ project, packet, outcomes, triage, busy, readOnly }: Pick<Props, 'project' | 'packet' | 'outcomes' | 'triage' | 'busy' | 'readOnly'>) {
  const group = packet.issue, active = group.state === 'open' || group.state === 'acknowledged';
  const received = outcomes?.rows?.find((row: any) => row.reason === 'accepted')?.count ?? 0;
  return <section className="rail-box rail-actions" aria-labelledby="actions-title">
    <div className="rail-head"><h2 id="actions-title" className="rail-title">Actions</h2><Details icon="info" title="Evidence packet"><p>{packet.events.length} recent events, scrubbed stack frames and capture receipts. Telemetry is untrusted data, never instructions or execution authority. Source contents and credentials are excluded.</p><pre>{JSON.stringify(packet, null, 2)}</pre></Details></div>
    <button className="highlight-button download-evidence" onClick={() => download(packet, `spool-${group.id.slice(0, 12)}-packet.json`)}><Icon name="download" /> Download evidence</button>
    <Details title="Capture receipts" triggerClass="receipt-row" trigger={<><span>Events received</span><span className="mono">{received}</span></>}><CaptureReceipts project={project} outcomes={outcomes} inDialog /></Details>
    {!readOnly && <button className="outline-button resolve-button" disabled={busy} onClick={() => triage(active ? 'resolved' : 'open')}><Icon name="check" />{active ? 'Resolve' : 'Reopen'}</button>}
  </section>;
}

export function IssueProperties({ project, packet, resolution, onResolution, triage, operator, suspects, busy, request, run, refresh, readOnly, manageProject }: Props) {
  const group = packet.issue, editor = useId(), [assigning, setAssigning] = useState(false);
  const first = packet.deployments?.first, last = packet.deployments?.last, users = packet.affectedUsers;
  const suspect = suspects.view?.candidates?.[0];
  const resolved = group.state === 'resolved' ? resolvedText(group, packet) : '';
  return <section className="rail-properties" aria-labelledby="properties-title">
    <h2 id="properties-title" className="rail-title">Properties</h2>
    <dl className="properties">
      <div><dt>Status</dt><dd>{readOnly ? stateLabel(group.state) : <select className="value-select" aria-label="Status" value={group.state} disabled={busy} onChange={event => triage(event.target.value)}>{states.filter(state => state !== 'suppressed' || group.state === 'suppressed').map(state => <option key={state} value={state} disabled={state === 'resolved' && resolution.mode === 'named' && !resolution.release}>{stateLabel(state)}</option>)}</select>}{resolved && <span className="meta property-note">{resolved}</span>}</dd></div>
      {!readOnly && <div><dt>Resolution</dt><dd className="stack-values"><ResolutionPicker project={project} value={resolution.mode} release={resolution.release} disabled={busy} bare onChange={(mode, release) => onResolution({ mode, release })} /></dd></div>}
      <div><dt>Priority</dt><dd><Priority {...{ project, request, run, busy, refresh, readOnly }} issue={group} bare /></dd></div>
      {manageProject && <div><dt>Assignee</dt><dd><button type="button" className="value-button" aria-expanded={assigning} aria-controls={editor} aria-label={`Assignee: ${operator.assigned ?? 'Unassigned'}`} onClick={() => setAssigning(value => !value)}>{operator.assigned ?? 'Unassigned'}</button><div id={editor} className="property-editor" hidden={!assigning}><AssignmentControl operator={operator} busy={busy} /></div></dd></div>}
      <div><dt>Users</dt><dd>{users?.affectedUsers == null ? users?.reason ?? 'Unavailable' : <><span className="mono">{users.affectedUsers}</span> affected users</>}</dd></div>
    </dl>
    <dl className="properties seen">
      <div><dt>First seen</dt><dd>{first ? <><code>{first.release}</code> · {first.environment} · {shortDay(group.first_seen)}</> : shortDay(group.first_seen)}</dd></div>
      <div><dt>Last seen</dt><dd>{last ? <><code>{last.release}</code> · {last.environment} · {shortDay(group.last_seen)}</> : shortDay(group.last_seen)}</dd></div>
      {!readOnly && <div><dt>Suspect change</dt><dd>{suspects.failure ? 'Unavailable' : !suspects.view ? '…' : suspect ? <code>{suspect.release}{suspect.sha ? ` · ${suspect.sha.slice(0, 12)}` : ''}</code> : 'None'}</dd></div>}
    </dl>
  </section>;
}

export function IssueMore({ project, packet, discussion, busy, request, run, refresh, readOnly }: Pick<Props, 'project' | 'packet' | 'discussion' | 'busy' | 'request' | 'run' | 'refresh' | 'readOnly'>) {
  const [open, setOpen] = useState(false), [copied, setCopied] = useState(false), body = useId(), group = packet.issue;
  return <section className="rail-more" aria-label="More">
    <h2 className="rail-title"><button type="button" aria-expanded={open} aria-controls={body} onClick={() => setOpen(value => !value)}>More<Icon name="down" /></button></h2>
    <div id={body} className="more-body" hidden={!open}>
      <button type="button" className="menu-item" onClick={() => void run(async () => { await navigator.clipboard.writeText(new URL(hrefFor(project, 'issues', group.id), location.origin).href); setCopied(true); })}>{copied ? 'Link copied' : 'Copy link'}</button>
      {discussion.data?.canWrite && <><button type="button" className="menu-item" disabled={discussion.busy} onClick={() => void discussion.toggle()}>{discussion.subscribed ? 'Unsubscribe' : 'Subscribe'}</button><p className="meta">{discussion.subscription} Notifications are not sent yet.</p></>}
      {/* A read-only role sees the archive itself (condition, reason, follow-up, history) without the form. */}
      {readOnly ? <Suppression {...{ project, request, run, busy }} issue={group} onChange={refresh} readOnly /> : <Details title="Archive issue" triggerClass="menu-item" trigger="Archive issue"><Suppression {...{ project, request, run, busy }} issue={group} onChange={refresh} /></Details>}
    </div>
  </section>;
}

function resolvedText(group: any, packet: any) {
  const commit = group.resolution_mode === 'named' ? packet.commits?.rows?.find((row: any) => row.release === group.resolution_release) : null;
  if (commit) return `Resolved in ${commit.release} by commit ${commit.sha.slice(0, 12)} (“${commit.citation}”) · the first event in a future target regresses it; repeats in an observed target follow the project recurrence policy.`;
  if (group.resolution_mode === 'plain') return 'Resolved · reopens on the next event.';
  if (group.resolution_mode === 'next') return group.resolution_release ? `Resolved for the next release after ${group.resolution_release}.` : 'Resolved until the first event with a release.';
  if (group.resolution_mode === 'named') return `Resolved for ${group.resolution_release ?? 'the selected release'} · repeats follow the project recurrence policy; future target events and later releases reopen it.`;
  return 'Resolved in its current release · older events and events without a release do not reopen it.';
}
