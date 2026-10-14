import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Details } from './Details';
import { OperatorPanel } from './OperatorPanel';
import { RepairPanel } from './RepairPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { attentionLabel, type Alert } from './attention';
import { hrefFor } from './location';
import { date, displayFile, download, stateLabel, states, type Request, type Run } from './shared';
// The evidence rail follows the stack trace: beside it on wide screens, directly under it on narrow ones.
export function IssueView({ project, packet, status, alert, busy, request, run, refresh, onUpload, onViewed, rail }: {
  project: string; packet: any; status: string; alert?: Alert; busy: boolean; request: Request; run: Run; refresh: () => void; onUpload: (release: string, debugId: string) => void; onViewed: (id: string) => void; rail: ReactNode;
}) {
  const [allFrames, setAllFrames] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => { if (packet && alert) onViewed(alert.id); }, [packet, alert?.id, onViewed]);
  if (!packet) return <section className="evidence">{status === 'loading' ? <p role="status">Loading issue evidence…</p> : <><h2>Issue evidence unavailable</h2><p>The issue may have been removed, or its evidence could not be loaded.</p><button className="text-button" onClick={refresh}>Retry evidence</button></>}</section>;
  const group = packet.issue, event = packet.events?.[0], frames: any[] = event?.currentLookup ?? [];
  const missing = frames.filter(frame => frame.status !== 'mapped');
  const imported = event?.historical === true;
  return <>
    <div className="issue-toolbar"><Link className="text-button" to={hrefFor(project) as any}>All issues</Link><button className="text-button" onClick={() => void run(async () => { await navigator.clipboard.writeText(new URL(hrefFor(project, 'issues', group.id), location.origin).href); setCopied(true); })}>{copied ? 'Link copied' : 'Copy link'}</button><button className="text-button" disabled={busy} onClick={refresh}>Refresh</button></div>
    <section className="issue">
      <div className="issue-summary"><div className="issue-body"><div className="issue-status"><span className={`state-chip ${group.state}`}>{stateLabel(group.state)}</span>{alert && <span className={`attention-badge ${alert.kind}`}>{attentionLabel(alert)}</span>}</div><p className="metadata">{event ? `${event.event.release} · ${event.event.environment}` : 'Occurrence evidence deleted by retention'}</p></div><p className="issue-count"><strong>{group.count}</strong> <span>retained occurrences</span></p>
      <div className="triage"><label className="form-field">Status<select value={group.state} disabled={busy} onChange={e => void run(async () => { await request(`/api/projects/${project}/issues/${group.id}`, 'PATCH', { state: e.target.value, revision: group.revision }); refresh(); })}>{states.map(state => <option key={state} value={state}>{stateLabel(state)}</option>)}</select></label></div>
        <button className="highlight-button phone-download" onClick={() => download(packet, `spool-${group.id.slice(0, 12)}-packet.json`)}><span aria-hidden="true">↓</span> Download evidence</button></div>
      <h2 className="stack-heading">Stack trace</h2>
      {imported && <p className="callout">Imported historical evidence. {frames.some(frame => frame.status === 'imported_symbolicated_stack') ? 'These locations were already symbolicated in the export; Spool has not verified their generated positions.' : 'These raw stack locations come from the export.'} This history does not trigger alerts or join live capture groups.</p>}
      {!imported && !!missing.length && <div className="callout missing-map"><strong>Original source unavailable for {missing.length === 1 ? 'one frame' : `${missing.length} frames`}</strong><p>{missing.some(frame => frame.status === 'missing_debug_id') ? 'Some frames have no debug ID. Add the bundle’s debug ID to capture and upload its matching map.' : missing.every(frame => ['unmapped_position', 'invalid_artifact'].includes(frame.status)) ? 'The stored map could not locate these positions. Check the generated coordinates and map diagnostics in Details.' : 'Upload the map matching this release, build and debug ID to locate the original source.'}</p><button className="text-button" onClick={() => onUpload(event.event.release, missing.find(frame => frame.generated.debugId)?.generated.debugId ?? '')}>Upload map</button></div>}
      <ol className="stack readable-stack">{frames.slice(0, allFrames ? 30 : 6).map((frame, index) => {
        const mapped = frame.status === 'mapped', position = mapped ? frame.original : frame.generated;
        return <li className={`stack-row ${mapped ? 'mapped-frame' : 'generated-frame'}${index ? '' : ' mark-bar'}`} key={index}><span className="line-no" aria-hidden="true">{index + 1}</span><div className="frame-text"><code className="frame-coordinate">{displayFile(position.file)}:{position.line}:{position.column}</code>{position.function ? <code className="frame-function">{position.function}</code> : <span className="frame-function">Anonymous function</span>}</div><span className="frame-source">{mapped ? 'Original source' : frame.status === 'imported_symbolicated_stack' ? 'Exported symbolicated location' : frame.status === 'imported_raw_stack' ? 'Exported raw location' : 'Generated source'}</span></li>;
      })}</ol>
      {!frames.length && <p>No retained stack frames.</p>}
      {frames.length > 6 && <button className="text-button" onClick={() => setAllFrames(!allFrames)}>{allFrames ? 'Show fewer frames' : `Show all ${frames.length} frames`}</button>}
      <Details title="Issue and source evidence"><p>Source maps enrich the current lookup. Original receipt records remain unchanged.</p><pre>{JSON.stringify({ issue: group, grouping: packet.grouping, events: packet.events }, null, 2)}</pre></Details>
    </section>
    {rail}
    <section className="evidence recent-occurrence"><h2>Recent occurrence</h2><dl className="issue-facts"><div><dt>Release</dt><dd>{event?.event.release ?? 'Unavailable'}</dd></div><div><dt>Environment</dt><dd>{event?.event.environment ?? 'Unavailable'}</dd></div><div><dt>Last received</dt><dd>{date(group.last_seen)}</dd></div>{group.client_dropped > 0 && <div><dt>Not sent by the SDK</dt><dd>{group.client_dropped} more at this location (rate cap or repeats)</dd></div>}</dl></section>
    <section className="evidence"><h2>Observed deployments</h2><p>First and last retained occurrence, ordered by receipt time. Manifest records are supplied by the owner or deploy key; registration order is not deployment order.</p>{(['first','last'] as const).map(key=>{const d=packet.deployments?.[key];return <div key={key}><h3>{key==='first'?'First seen':'Last seen'}</h3><p>{d?`${d.release} · ${d.environment}`:'No retained occurrence'}</p>{d?.manifest?<p><a href={d.manifest.repository} rel="noreferrer" target="_blank">Repository</a> · <code>{d.manifest.commit_sha}</code> · {date(d.manifest.deployed_at)}</p>:<p>Deployment and commit unknown for this environment.</p>}</div>})}</section>
    <OperatorPanel project={project} packet={packet} busy={busy} request={request} run={run} refresh={refresh}/>
    <RepairPanel project={project} issue={group} busy={busy} request={request} run={run} refresh={refresh} />
    <ExecutionPanel project={project} issue={group} event={event} busy={busy} request={request} run={run} />
    <p className="callout issue-caveat">Resolved records your triage decision. A quiet feed does not prove a repair or complete capture; review exported evidence for personal data before sharing.</p>
  </>;
}
