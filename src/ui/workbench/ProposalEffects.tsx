import { plural } from './readable';
import { date } from './shared';
import { proposalText, type ProposalLabels } from './proposalEvidence';

const alertKinds: Record<string, string> = { new_issue: 'New issue', regression: 'Regression', reactivation: 'Reactivation', spike: 'Spike' };
const verdicts: Record<string, string> = { recurred: 'Recurred', inconclusive: 'Inconclusive', no_recurrence_after_exercise: 'No recurrence after exercise' };
const alertKind = (kind: string) => alertKinds[kind] ?? proposalText(kind);

export function ProposalAlertEffects({ alerts, labels }: { alerts: any; labels: ProposalLabels }) {
  return <><h4>Alert effects</h4><p>{proposalText(alerts.behavior)}</p>
    <strong>Configured rules</strong>
    {alerts.rules.length ? <ul>{alerts.rules.map((rule: any, index: number) => {
      const kinds: string[] = typeof rule.kinds === 'string' ? JSON.parse(rule.kinds) : rule.kinds;
      return <li key={rule.id}><p>Alert rule {index + 1} · {rule.enabled ? 'Enabled' : 'Disabled'} · revision {rule.revision}</p>
        <dl><div><dt>Alert types</dt><dd>{kinds.map(alertKind).join(', ')}</dd></div><div><dt>Spike threshold</dt><dd>{rule.threshold} {plural(rule.threshold, 'event')} in {rule.window_ms / 60000} {plural(rule.window_ms / 60000, 'minute')}</dd></div>
          <div><dt>Evaluation window</dt><dd>{date(rule.window.start)} → {date(rule.window.end)}</dd></div></dl>
        <ul>{rule.issues.map((issue: any) => <li key={issue.issue}>{labels.issue(issue.issue)}: {issue.before} → {issue.after} eligible {plural(issue.after, 'event')}; spike condition {issue.conditionBefore ? 'met' : 'not met'} → {issue.conditionAfter ? 'met' : 'not met'}.</li>)}</ul>
      </li>;
    })}</ul> : <p>No alert rules recorded.</p>}
    <strong>Open alerts</strong>
    {alerts.open.length ? <ul>{alerts.open.map((alert: any) => <li key={alert.id}>{alertKind(alert.kind)} · {labels.issue(alert.issue)} · {date(alert.created)} · Preserved.
      {!!alert.movedEvents.length && <p>Affected events: {alert.movedEvents.map((event: string) => labels.event(event)).join(', ')}.</p>}
    </li>)}</ul> : <p>No open alerts recorded.</p>}
  </>;
}

export function ProposalRepairEffects({ repair, labels }: { repair: any; labels: ProposalLabels }) {
  return <><h4>Repair verification effects</h4><p>{proposalText(repair.behavior)}</p>
    {repair.observations.length ? <ul>{repair.observations.map((row: any, index: number) => {
      const observation = row.observation, evidence = observation.evidence;
      return <li key={row.id}><p><strong>Repair {index + 1} · {labels.issue(row.issue)}</strong> · recorded {date(row.created)}</p>
        <dl><div><dt>Verification</dt><dd>{verdicts[observation.verdict] ?? proposalText(observation.verdict)}</dd></div>
          <div><dt>Deployed release</dt><dd>{evidence.release ? `${proposalText(evidence.release.name)} · build ${proposalText(evidence.release.build)} · sequence ${evidence.release.sequence} · registered ${date(evidence.release.registered)}` : 'Not deployed in a registered release'}</dd></div>
          <div><dt>Observation window</dt><dd>{evidence.window ? `${date(evidence.window.start)} → ${date(evidence.window.end)}` : 'Not established'}</dd></div>
          <div><dt>Recurrence</dt><dd>{evidence.recurrence.count} {plural(evidence.recurrence.count, 'event')}</dd></div>
          <div><dt>Older release events</dt><dd>{evidence.olderReleaseEvents.count} · excluded from recurrence</dd></div>
          <div><dt>Capture from deployed release</dt><dd>{evidence.releaseEvents} {plural(evidence.releaseEvents, 'event')}</dd></div>
          <div><dt>Source map</dt><dd>{evidence.mapStored ? 'Stored' : 'Not stored'}</dd></div>
        </dl>
        {!!observation.reasons.length && <><strong>Reasons</strong><ul>{observation.reasons.map((reason: any, i: number) => <li key={i}>{proposalText(reason.reason)}</li>)}</ul></>}
        {(['recurrence', 'olderReleaseEvents'] as const).map(key => evidence[key].events.length ? <div key={key}><strong>{key === 'recurrence' ? 'Recurrence evidence' : 'Older release evidence'}</strong><ul>{evidence[key].events.map((event: any, i: number) => <li key={i}>{labels.event(event.id)} · release {proposalText(event.release)} · sequence {event.sequence} · received {date(event.received)}</li>)}</ul></div> : null)}
        {!!evidence.loss.length && <><strong>Capture losses</strong><ul>{evidence.loss.map((loss: any, i: number) => <li key={i}>{proposalText(loss.reason).replaceAll('_', ' ')}: {loss.count}</li>)}</ul></>}
        {!!row.correctionAuditTimes.length && <><strong>Grouping changes since this repair</strong><ul>{row.correctionAuditTimes.map((audit: any, i: number) => <li key={i}>{audit.kind === 'grouping_applied' ? 'Correction applied' : 'Correction undone'} · {date(audit.created)}</li>)}</ul></>}
        <p>{proposalText(observation.limits)}</p>
      </li>;
    })}</ul> : <p>No repair observations recorded.</p>}
  </>;
}
