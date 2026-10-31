import { useState } from 'react';
import './live-copy.css';
import { date } from './shared';

function RecordedEvidence({ rows, empty }: { rows: any[]; empty: string }) {
  return rows.length ? <ul>{rows.map((row, index) => <li key={index}><pre>{JSON.stringify(row, null, 2)}</pre></li>)}</ul> : <p>{empty}</p>;
}

const traceReason=(reason:string)=>({native_event:'native event has no Sentry trace context',missing_trace_context:'no retained trace context',invalid_trace_context:'malformed trace context',missing_trace_id:'trace context has no identity',invalid_trace_id:'trace identity is not a nonzero 32-character hexadecimal ID'}[reason]??'no retained reference event');
function Variant({ variant }: { variant:any }) {
 const {trace,...base}=variant;
 return <><pre>{JSON.stringify(base,null,2)}</pre>{trace&&<p>Trace {trace.id?<><code>{trace.id}</code> · {trace.comparison==='same'?'same as reference':trace.comparison==='different'?'different from reference':'comparison unavailable: reference has no valid trace identity'}</>:<>unavailable: {traceReason(trace.unavailable)}</>}.</p>}</>;
}

function Variants({ rows, inside }: { rows: any[]; inside?: boolean }) {
  if (!rows.length) return <p>No {inside ? 'differing variants inside the selected group' : 'look-alike events outside the selected group'} in the retained evidence.</p>;
  return <ul>{rows.map((row, index) => <li key={row.event ?? index}>
    <p>Event <code>{row.event}</code>{row.issue && <> · issue <code>{row.issue}</code></>}{row.occurrence && <> · occurrence <code>{row.occurrence}</code></>}</p>
    <Variant variant={row.variant} />
    {inside && <p>Differs in: {row.differing.join(', ') || 'no recorded differences'}.</p>}
  </li>)}</ul>;
}

export function GroupingExplanation({ explanation }: { explanation: any }) {
  return <div className="grouping-explanation">
    <p>Spool computed these effects from retained evidence. Decided proposals keep the review snapshot; subsequent repair observations remain in the issue packet.</p>
    <h4>Exact affected events ({explanation.affected.length})</h4>
    {explanation.affected.length ? <ol>{explanation.affected.map((row: any) => <li key={`${row.event}:${row.occurrence}`}>
      <p>Event <code>{row.event}</code> · occurrence <code>{row.occurrence}</code></p>
      <p><code>{row.from}</code> → <code>{row.to}</code></p>
      <Variant variant={row.variant} />
    </li>)}</ol> : <p>No events move. Rule changes apply to future events.</p>}
    <h4>Counterexamples inside the group</h4><Variants rows={explanation.counterexamples.inside} inside />
    <h4>Look-alike events outside the group</h4><Variants rows={explanation.counterexamples.outside} />
    <h4>Trace comparison</h4>
    {typeof explanation.trace==='string'?<p>{explanation.trace}</p>:<>
      <p>{explanation.trace.scope}</p>
      <p>{explanation.trace.reference?<>Reference event <code>{explanation.trace.reference.event}</code> · occurrence <code>{explanation.trace.reference.occurrence}</code>: {explanation.trace.reference.id?<code>{explanation.trace.reference.id}</code>:<>trace unavailable: {traceReason(explanation.trace.reference.unavailable)}</>}.</>:<>Trace comparison unavailable: no retained reference event.</>}</p>
    </>}
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

/** The recorded grouping facts, shared by native and Sentry event dialogs. */
export function GroupingFacts({ grouping, event }: { grouping: any; event: any }) {
  const [copied, setCopied] = useState(false);
  if (!grouping) return <p>No grouping information was recorded for this event.</p>;
  const contributions = grouping.frames ?? grouping.stack ?? [];
  const chosen = contributions.find((frame: any) => frame.contributes);
  const frame = event.frames?.[chosen?.index] ?? event.stacktrace?.frames?.[chosen?.index];
  const name = frame?.function ?? frame?.raw_function;
  const type = event.type ?? event.exceptions?.[0]?.type;
  const custom = grouping.variant === 'custom fingerprint';
  const summary = !grouping.variant ? 'This is the grouping recorded when this event arrived.' : custom ? 'Grouped by a custom fingerprint.'
    : grouping.variant === 'message' ? `Grouped by the message: ${grouping.message.template}`
    : grouping.variant === 'exception value' ? `Grouped by ${type ?? 'the exception type'} and its message.`
    : name ? `Grouped by ${type ?? 'the error'} in ${name}.`
    : grouping.exceptions?.length ? 'Grouped by the related exceptions and their contributing frames.'
    : 'Grouped by the exception type and contributing stack frames.';
  const reason = (row: any) => row.contributes ? 'Used to group this event'
    : row.hidden ? 'Hidden by the application'
    : row.reason === 'later native frame' ? 'An earlier frame determines this group'
    : row.inApp === false ? 'Library frame; excluded from this group'
    : custom ? 'The custom fingerprint determines this group'
    : 'Excluded by the grouping rules';
  const frames = (rows: any[], source: any[]) => <ul>{rows.map((row: any) => <li key={row.index}>Frame {row.index + 1}{source[row.index]?.function ? ` · ${source[row.index].function}` : ''}: {reason(row)}{row.rules?.length ? ` · stack rule ${row.rules.join(', ')}` : ''}.</li>)}</ul>;
  return <>
    <p>{summary}</p>
    {grouping.projectFingerprintRule != null && <p>Project fingerprint rule {grouping.projectFingerprintRule} matched.</p>}
    {(grouping.revision ?? grouping.ruleRevision) != null && <p>Grouping policy revision {grouping.revision ?? grouping.ruleRevision}.</p>}
    {!!contributions.length && frames(contributions, event.frames ?? event.stacktrace?.frames ?? [])}
    {grouping.exceptions?.map((exception: any) => <div key={exception.index}><h3>{exception.type ?? 'Exception'}{exception.value ? `: ${exception.value}` : ''}</h3><p>{exception.valueContributes ? 'Its type and message determine the group; no frame contributes.' : custom ? 'The custom fingerprint determines the group.' : 'Its type and contributing frames determine the group; the message is excluded.'}</p>{frames(exception.frames ?? [], event.exceptions?.[exception.index]?.stacktrace?.frames ?? [])}</div>)}
    {typeof grouping.fingerprint === 'string' && <p className="grouping-fingerprint"><strong>Fingerprint</strong> <code>{grouping.fingerprint}</code> <button className="text-button" onClick={() => void navigator.clipboard.writeText(grouping.fingerprint).then(() => setCopied(true))}>{copied ? 'Fingerprint copied' : 'Copy fingerprint'}</button></p>}
  </>;
}
