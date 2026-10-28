import { Details } from './Details';
import { date, type Request } from './shared';

const statusLabel: Record<string, string> = {
  proposed: 'Proposed, waiting for your approval', approved_awaiting_connection: 'Approved, awaiting connection', approved: 'Approved', grant_expired: 'Grant expired',
  pull_request_open: 'Draft pull request open', merged: 'Merged', deployed: 'Deployed',
};
const verdictLabel: Record<string, string> = { reached: 'Reached the affected users', recurred: 'Recurred after the deploy', inconclusive: 'Inconclusive' };
const percent = (value: number | null) => value === null ? 'unknown' : `${(value * 100).toFixed(1)}%`;
type Props = { project: string; workflow: any; busy: boolean; write: (work: () => Promise<unknown>) => Promise<void>; request: Request };

export function FixWorkflowCard({ project, workflow, busy, write, request }: Props) {
  const { grant, states } = workflow, path = `/api/projects/${encodeURIComponent(project)}/fixes/${encodeURIComponent(workflow.id)}`, label = `fix-${workflow.id}`;
  const act = (step: 'approve' | 'advance') => write(() => request(`${path}/${step}`, 'POST', { revision: workflow.revision }));
  const approvable = !states.approved || states.approved.expired, connected = workflow.connection.state === 'configured';
  return <article className="fix" aria-labelledby={label}>
    <h3 id={label}>{grant.repository}: <code>{grant.branch}</code> → <code>{grant.base}</code></h3>
    <p className={`fix-status ${workflow.status}`}><strong>{statusLabel[workflow.status] ?? workflow.status}</strong></p>
    {workflow.preparedBy && <p className="execution-meta">Prepared by {workflow.preparedBy.label}. Native repository consent: {workflow.approvedBy?.map((p: any) => p.name).join(', ') || 'not authorized'}.</p>}
    <dl className="execution-facts">
      <div><dt>Proposed</dt><dd>{date(states.proposed.at)}</dd></div>
      <div><dt>Approved</dt><dd>{states.approved ? `${date(states.approved.at)}; ${states.approved.expired ? 'expired' : 'expires'} ${date(states.approved.expires)}` : 'Not approved'}</dd></div>
      <div><dt>Pull request</dt><dd>{states.pullRequest ? <a href={states.pullRequest.url} target="_blank" rel="noopener noreferrer">#{states.pullRequest.number} (draft)</a> : 'Not opened'}</dd></div>
      <div><dt>Merged</dt><dd>{states.merged ? <>{date(states.merged.at)}, <code>{states.merged.commit.slice(0, 12)}</code> (from a provider receipt)</> : 'Not observed'}</dd></div>
      <div><dt>Deployed</dt><dd>{states.deployed ? `${states.deployed.release} in ${states.deployed.environment}, ${date(states.deployed.at)} (from ${states.deployed.source === 'deployment_manifest' ? 'a deployment manifest naming the merge commit' : 'a deployment manifest and a compare receipt'})` : 'No deployment contains the merge yet'}</dd></div>
      {workflow.ci && <div><dt>Checks on {workflow.ci.head?.slice(0, 12)}</dt><dd>{workflow.ci.total ? workflow.ci.runs.map((run: any) => `${run.name}: ${run.conclusion ?? run.status}`).join(', ') : 'No checks reported'}</dd></div>}
    </dl>
    <Details title="Exact grant" triggerLabel="Show grant">
      <ul className="grant">
        <li>Repository <code>{grant.repository}</code>; writes only branch <code>{grant.branch}</code> from <code>{grant.base}</code></li>
        <li>Adds one file, <code>{grant.file.path}</code> ({grant.file.bytes} bytes, SHA-256 <code>{grant.file.sha256.slice(0, 16)}…</code>), the reproducer record as data</li>
        <li>Opens a draft pull request titled “{grant.pullRequest.title}”</li>
        <li>GitHub token: {Object.entries(grant.permissions).map(([name, level]) => `${name} ${level}`).join(', ')}, this repository only, revoked after each step</li>
        <li>Operations: {grant.operations.join(', ')}</li>
        <li>Never: {grant.never.join('; ')}</li>
        <li>Lasts {grant.durationMinutes} minute{grant.durationMinutes === 1 ? '' : 's'} from approval</li>
      </ul>
    </Details>
    <div className="fix-actions">
      {approvable && <button className="primary-button" disabled={busy} onClick={() => void act('approve')}>{states.approved ? 'Approve a renewed grant' : 'Approve this exact grant'}</button>}
      {states.approved && !states.approved.expired && connected && !states.deployed && <button className="text-button" disabled={busy} onClick={() => void act('advance')}>{states.pullRequest ? 'Read pull request, checks and deployments' : 'Open branch and draft pull request'}</button>}
    </div>
    {workflow.exposure && <Exposure proof={workflow.exposure} />}
    <Details title={`Receipts (${workflow.receipts.length})`} triggerLabel="Show receipts">
      {workflow.receipts.length ? <ol className="receipts">{workflow.receipts.map((receipt: any) => <li key={receipt.id}><strong>{receipt.step}</strong> {receipt.method} <code>{receipt.target}</code>: {receipt.outcome}{receipt.status ? ` (HTTP ${receipt.status})` : ''}, {date(receipt.at)}<pre>{JSON.stringify(receipt.detail)}</pre></li>)}</ol> : <p>No external effect yet.</p>}
    </Details>
  </article>;
}

function Exposure({ proof }: { proof: any }) {
  const d = proof.denominators;
  return <div className={`callout verdict exposure ${proof.verdict}`}>
    <strong>After the deploy: {verdictLabel[proof.verdict]}</strong>
    <ul>{proof.reasons.map((reason: any) => <li key={reason.code}>{reason.reason}</li>)}</ul>
    <dl className="execution-facts">
      <div><dt>Affected users (cohort)</dt><dd>{d.cohort.affectedUsers} before the deploy; {d.cohort.reachedOnFixedRelease} reached the fixed flow; {d.cohort.unattributedEvents} events without a client</dd></div>
      <div><dt>Rollout</dt><dd>{d.rollout.onFixedRelease} of {d.rollout.usersSinceDeploy} active users on the fixed release ({percent(d.rollout.share)})</dd></div>
      <div><dt>Traffic</dt><dd>{d.traffic.sessionReportsOnFixedRelease} session reports on the fixed release</dd></div>
      <div><dt>Instrumentation ({d.instrumentation.flow})</dt><dd>{d.instrumentation.withCapture} exposed with capture, {d.instrumentation.withoutCapture} without; before the fix {d.instrumentation.baselineFailed} of {d.instrumentation.baselineExposed} failed ({percent(d.instrumentation.baselineRate)})</dd></div>
      <div><dt>Capture gap</dt><dd>{d.captureGap.loss.length ? d.captureGap.loss.map((row: any) => `${row.reason} ${row.count}`).join(', ') : 'No server-side loss'}; {d.captureGap.usersWithoutCapture} exposed users without capture</dd></div>
      <div><dt>If the fix changed nothing</dt><dd>{d.expectedFailuresIfUnfixed === null ? 'No baseline' : `at a rate of at least ${percent(d.instrumentation.baselineRateLowerBound)} (95% lower bound), about ${d.expectedFailuresIfUnfixed.toFixed(1)} failures expected; chance of none ${percent(d.chanceOfNoFailureIfUnfixed)}`}</dd></div>
    </dl>
    <p>{proof.limits}</p>
  </div>;
}
