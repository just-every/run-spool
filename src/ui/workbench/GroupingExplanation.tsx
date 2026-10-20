import { date } from './shared';

function RecordedEvidence({ rows, empty }: { rows: any[]; empty: string }) {
  return rows.length ? <ul>{rows.map((row, index) => <li key={index}><pre>{JSON.stringify(row, null, 2)}</pre></li>)}</ul> : <p>{empty}</p>;
}

function Variants({ rows, inside }: { rows: any[]; inside?: boolean }) {
  if (!rows.length) return <p>No {inside ? 'differing variants inside the selected group' : 'look-alike events outside the selected group'} in this retained window.</p>;
  return <ul>{rows.map((row, index) => <li key={row.event ?? index}>
    <p>Event <code>{row.event}</code>{row.issue && <> · issue <code>{row.issue}</code></>}{row.occurrence && <> · occurrence <code>{row.occurrence}</code></>}</p>
    <pre>{JSON.stringify(row.variant, null, 2)}</pre>
    {inside && <p>Differs in: {row.differing.join(', ') || 'no recorded differences'}.</p>}
  </li>)}</ul>;
}

export function GroupingExplanation({ explanation }: { explanation: any }) {
  return <div className="grouping-explanation">
    <h4>Exact affected events ({explanation.affected.length})</h4>
    {explanation.affected.length ? <ol>{explanation.affected.map((row: any) => <li key={`${row.event}:${row.occurrence}`}>
      <p>Event <code>{row.event}</code> · occurrence <code>{row.occurrence}</code></p>
      <p><code>{row.from}</code> → <code>{row.to}</code></p>
      <pre>{JSON.stringify(row.variant, null, 2)}</pre>
    </li>)}</ol> : <p>No retained occurrences move. Rule changes affect later intake only.</p>}
    <h4>Counterexamples inside the group</h4><Variants rows={explanation.counterexamples.inside} inside />
    <h4>Look-alike events outside the group</h4><Variants rows={explanation.counterexamples.outside} />
    <p>{explanation.trace}</p>
    <h4>Projected counts and rates</h4>
    <p>Retained window: {date(explanation.window.start)} → {date(explanation.window.end)}.</p>
    <ul>{explanation.rates.map((row: any) => <li key={row.issue}><code>{row.issue}</code>: {row.before} → {row.after} events (change {row.delta}); {row.perMinuteBefore} → {row.perMinuteAfter} per minute.</li>)}</ul>
    <h4>Recorded ownership</h4>
    <ul>{explanation.ownership.map((row: any) => <li key={row.issue}><code>{row.issue}</code>: {row.label ?? 'Unassigned'}</li>)}</ul>
    <h4>Alert effects</h4><p>{explanation.alerts.behavior}</p>
    <strong>Configured rules</strong><RecordedEvidence rows={explanation.alerts.rules} empty="No alert rules recorded." />
    <strong>Open alerts</strong><RecordedEvidence rows={explanation.alerts.open} empty="No open alerts recorded." />
    <h4>Repair verification effects</h4><p>{explanation.repair.behavior}</p>
    <RecordedEvidence rows={explanation.repair.observations} empty="No repair observations recorded." />
    <p>{explanation.behavior}</p>
  </div>;
}
