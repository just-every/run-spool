import {Suppression} from './Suppression';
import {Discussion} from './Discussion';
import {Priority} from './Priority';
import {AffectedUsers} from './AffectedUsers';
import {SuspectChanges} from './SuspectChanges';
import {ResolutionPicker} from './ResolutionPicker';
import { RepositorySource } from './RepositorySource';
import { CommitTimeline } from './CommitTimeline';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { IssuePanels } from './issuePanels';
import { GroupingFacts } from './GroupingExplanation';
import { Details } from './Details';
import { EventExplorer } from './EventExplorer';
import { FeedbackPanel } from './FeedbackPanel';
import { SentryEvent } from './SentryEvent';
import { CheckInLink } from './CheckInLink';
import { OperatorPanel } from './OperatorPanel';
import { RepairPanel } from './RepairPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { attentionLabel, type Alert } from './attention';
import { hrefFor } from './location';
import { date, displayFile, download, stateLabel, states, type Request, type Run } from './shared';
// The evidence rail follows the stack trace: beside it on wide screens, directly under it on narrow ones.
export function IssueView({ project, packet, panels, status, alert, busy, request, run, refresh, onUpload, onViewed, rail, readOnly = false, manageProject = true, manageOrganization = true }: {
  project: string; packet: any; panels: IssuePanels | null; status: string; alert?: Alert; busy: boolean; request: Request; run: Run; refresh: () => void; onUpload: (release: string, debugId: string) => void; onViewed: (id: string) => void; rail: ReactNode; readOnly?: boolean; manageProject?: boolean; manageOrganization?: boolean;
}) {
  const [allFrames, setAllFrames] = useState(false), [copied, setCopied] = useState(false);
  const [resolution,setResolution]=useState('plain'),[resolutionRelease,setResolutionRelease]=useState('');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  useEffect(()=>setSelectedEvent(null),[project,packet?.issue.id]);
  useEffect(() => { if (packet && alert) onViewed(alert.id); }, [packet, alert?.id, onViewed]);
  if (!packet) return <section className="evidence">{status === 'loading' ? <p role="status">Loading issue evidence…</p> : <><h2>Issue evidence unavailable</h2><p>The issue may have been removed, or its evidence could not be loaded.</p><button className="text-button" onClick={refresh}>Retry evidence</button></>}</section>;
  const group = packet.issue, event = selectedEvent ?? packet.events?.[0], frames: any[] = event?.currentLookup ?? [];
  const missing = frames.filter(frame => !['mapped','go_path_mapped','python_source'].includes(frame.status));
  const language = event?.event.language;
  const imported = event?.historical === true;
  const sample = event?.event.environment === 'spool-test';
  const commitResolution = group.resolution_mode === 'named' ? packet.commits?.rows?.find((row: any) => row.release === group.resolution_release) : null;
  return <>
    <div className="issue-toolbar"><Link className="text-button" to={hrefFor(project) as any}>All issues</Link><button className="text-button" onClick={() => void run(async () => { await navigator.clipboard.writeText(new URL(hrefFor(project, 'issues', group.id), location.origin).href); setCopied(true); })}>{copied ? 'Link copied' : 'Copy link'}</button></div>
    <EventExplorer key={`${project}:${group.id}`} project={project} issue={group.id} refresh={packet} onSelect={setSelectedEvent}/>
    <section className="issue">
      <div className="issue-summary"><div className="issue-body"><div className="issue-status">{group.short_id && <code className="short-id" title="Short ID">{group.short_id}</code>}<span className={`state-chip ${group.state}`}>{stateLabel(group.state)}</span>{readOnly&&<Priority {...{project,request,run,busy,refresh,readOnly}} issue={group}/>}{alert && <span className={`attention-badge ${alert.kind}`}>{attentionLabel(alert)}</span>}</div><p className="metadata">{event ? `${event.event.release||'none'} · ${event.event.environment}` : 'Occurrence evidence deleted by retention'}</p></div><p className="issue-count"><strong>{group.count}</strong> <span>events</span></p>
      {!readOnly && <div className="triage"><label className="form-field">Status<select value={group.state} disabled={busy} onChange={e => void run(async () => { await request(`/api/projects/${project}/issues/${group.id}`, 'PATCH', { state: e.target.value, revision: group.revision, ...(e.target.value==='resolved'?{resolution,...resolution==='named'?{release:resolutionRelease}:{}}:{}) }); refresh(); })}>{states.filter(state=>state!=='suppressed'||group.state==='suppressed').map(state => <option key={state} value={state} disabled={state==='resolved'&&resolution==='named'&&!resolutionRelease}>{stateLabel(state)}</option>)}</select></label><ResolutionPicker project={project} value={resolution} release={resolutionRelease} disabled={busy} onChange={(mode,release)=>{setResolution(mode);setResolutionRelease(release)}}/><Priority {...{project,request,run,busy,refresh,readOnly}} issue={group}/></div>}
        <button className="highlight-button phone-download" onClick={() => download(packet, `spool-${group.id.slice(0, 12)}-packet.json`)}><span aria-hidden="true">↓</span> Download evidence</button></div>
      {group.state==='resolved'&&<p className="metadata">{commitResolution?`Resolved in ${commitResolution.release} by commit ${commitResolution.sha.slice(0,12)} (“${commitResolution.citation}”) · the first event in a future target regresses it; repeats in an observed target follow the project recurrence policy.`:group.resolution_mode==='plain'?'Resolved · reopens on the next event.':group.resolution_mode==='next'?(group.resolution_release ? `Resolved for the next release after ${group.resolution_release}.` : 'Resolved until the first event with a release.'):group.resolution_mode==='named'?`Resolved for ${group.resolution_release??'the selected release'} · repeats follow the project recurrence policy; future target events and later releases reopen it.`:'Resolved in its current release · older events and events without a release do not reopen it.'}</p>}{!!group.seen_without_release&&<p className="callout">{group.seen_without_release} seen with no release after resolve. Inspect these occurrences in All Events with !has:release.</p>}
      {packet.shortIdRequest?.alias && <p className="callout" role="status">{packet.shortIdRequest.requested} is an alias of {group.short_id}: that issue was merged here, and every link to it opens this issue.</p>}
      {!!group.short_id_aliases?.length && <p className="metadata short-id-aliases">Also answers to {group.short_id_aliases.join(', ')}.</p>}
      {group.short_id_resolves_to && <p className="callout">{group.short_id} now resolves to {group.short_id_resolves_to}, where these occurrences were merged.</p>}
      {selectedEvent&&<p className="metadata" data-event-id={selectedEvent.id}>{date(selectedEvent.received)} · {selectedEvent.event.type}: {selectedEvent.event.message}</p>}
      <CheckInLink checkIns={event?.checkIns}/>
      {event?.event.sentry&&<SentryEvent data={event.event.sentry} grouping={selectedEvent?.grouping??event.originalGrouping}/>}
      {event&&!event.event.sentry&&<Details title="Event grouping information" triggerLabel="Grouping information"><GroupingFacts grouping={selectedEvent?.grouping ?? event.originalGrouping} event={event.event} /></Details>}
      <h2 className="stack-heading">{event?.event.sentry?'Primary exception source lookup':'Stack trace'}</h2>
      {sample && <p className="callout"><strong>Spool’s sample error.</strong> This stack comes from the Send test error button in Spool. It checks that your key and release can receive an error. It does not need a source map from your app.</p>}
      {packet.events?.some((occurrence: any) => occurrence.event.exceptionSource === 'parsed-text') && <p className="callout">Exception type and frames were parsed from text for some events. Message text can imitate a traceback; these are best-effort reported locations.</p>}
      {imported && <p className="callout">Imported historical evidence. {frames.some(frame => frame.status === 'imported_symbolicated_stack') ? 'These locations were already symbolicated in the export; Spool has not verified their generated positions.' : 'These raw stack locations come from the export.'} This history does not trigger alerts or join live capture groups.</p>}
      {language && <p className="callout">{language === 'python' ? event?.event.sentry ? 'Python paths are reported source coordinates. Source-map symbolication is unavailable; SDK context above is retained as sent.' : 'Python reported source paths. Source content and symbolication are unavailable.' : 'Go reported source paths. Recorded release prefixes can map to repository paths; binary and DWARF symbolication are unavailable.'} The sandbox reproducer supports JavaScript only.</p>}
      {language === 'go' && !!missing.length && <p className="callout">{missing.some(frame => frame.status === 'go_mapping_unavailable') ? 'No path mappings are recorded for this release, build and environment. Register a deployment manifest with path mappings in Releases.' : 'Some reported paths do not match the recorded deployment prefixes.'}</p>}
      {!language && !imported && !sample && !!missing.length && <div className="callout missing-map"><strong>Original source unavailable for {missing.length === 1 ? 'one frame' : `${missing.length} frames`}</strong><p>{missing.some(frame => frame.status === 'missing_debug_id') ? 'Some frames have no debug ID. Add the bundle’s debug ID to capture and upload its matching map.' : missing.every(frame => ['unmapped_position', 'invalid_artifact'].includes(frame.status)) ? 'The stored map could not locate these positions. Check the generated coordinates and map diagnostics in Details.' : 'Upload the map matching this release, build and debug ID to locate the original source.'}</p>{!readOnly && <button className="text-button" onClick={() => onUpload(event.event.release, missing.find(frame => frame.generated.debugId)?.generated.debugId ?? '')}>Upload map</button>}</div>}
      <ol className="stack readable-stack">{frames.slice(0, allFrames ? 30 : 6).map((frame, index) => {
        const mapped = ['mapped','go_path_mapped'].includes(frame.status), position = mapped ? frame.original : frame.generated;
        const row=<><span className="line-no" aria-hidden="true">{index + 1}</span><div className="frame-text"><code className="frame-coordinate">{displayFile(position.file)}:{position.line}{position.column == null ? '' : `:${position.column}`}</code>{position.function ? <code className="frame-function">{position.function}</code> : <span className="frame-function">Anonymous function</span>}<RepositorySource source={event?.repositorySources?.[index]}/></div><span className="frame-source">{sample ? 'Spool sample' : frame.status === 'go_path_mapped' ? 'Repository path' : language ? 'Reported source' : mapped ? 'Original source' : frame.status === 'imported_symbolicated_stack' ? 'Exported symbolicated location' : frame.status === 'imported_raw_stack' ? 'Exported raw location' : 'Generated source'}</span></>;
        const rowClass=`stack-row ${mapped ? 'mapped-frame' : 'generated-frame'}${index ? '' : ' mark-bar'}`;
        return !event?.event.sentry&&(selectedEvent?.grouping??event?.originalGrouping)?.frames?.[index]?.inApp===false?<li key={index}><details><summary>Library frame · not in app</summary><div className={rowClass}>{row}</div></details></li>:<li className={rowClass} key={index}>{row}</li>;
      })}</ol>
      {!frames.length && <p>No retained stack frames.</p>}
      {frames.length > 6 && <button className="text-button" onClick={() => setAllFrames(!allFrames)}>{allFrames ? 'Show fewer frames' : `Show all ${frames.length} frames`}</button>}
      <Details title="Issue and source evidence"><p>Source maps and recorded repository path mappings enrich the current lookup. Original receipt records remain unchanged.</p><pre>{JSON.stringify({ issue: group, grouping: packet.grouping, events: packet.events }, null, 2)}</pre></Details>
    </section>
    <div className="issue-collaboration"><Suppression {...{project,request,run,busy,readOnly}} issue={group} onChange={refresh}/>
    <Discussion project={project} issue={group.id} refresh={packet} request={request} onChanged={refresh}/></div>
    <CommitTimeline project={project} issue={group.id} shortId={group.short_id} refresh={packet} request={request}/>
    <AffectedUsers project={project} issue={group.id} {...{request}} refresh={packet}/>
    {!readOnly && <SuspectChanges project={project} issue={group.id} {...{request,run,busy}} refresh={group.id}/>}
    {manageOrganization && <FeedbackPanel key={`${project}:${group.id}`} project={project} issue={group.id} {...{request,run,busy}}/>}
    {rail}
    <section className="evidence recent-occurrence"><h2>Recent occurrence</h2><dl className="issue-facts"><div><dt>Language</dt><dd>{language ?? 'javascript'}</dd></div><div><dt>Release</dt><dd>{event?.event.release ?? 'Unavailable'}</dd></div><div><dt>Environment</dt><dd>{event?.event.environment ?? 'Unavailable'}</dd></div><div><dt>Last received</dt><dd>{date(group.last_seen)}</dd></div>{group.client_dropped > 0 && <div><dt>Not sent by the SDK</dt><dd>{group.client_dropped} more at this location (rate cap or repeats)</dd></div>}</dl></section>
    <section className="evidence"><h2>Observed deployments</h2><Details title="Observed deployments"><p>First and last events by receipt time. Deployment details are supplied by you or your deploy key.</p></Details>{(['first','last'] as const).map(key=>{const d=packet.deployments?.[key];return <div key={key}><h3>{key==='first'?'First seen':'Last seen'}</h3><p>{d?`${d.release} · ${d.environment}`:'No retained occurrence'}</p>{d?.manifest?<p><a href={d.manifest.repository} rel="noreferrer" target="_blank">Repository</a> · <code>{d.manifest.commit_sha}</code> · {date(d.manifest.deployed_at)}</p>:<p>Deployment and commit unknown for this environment.</p>}</div>})}</section>
    {manageProject && <OperatorPanel initial={panels?.operator} project={project} packet={packet} busy={busy} request={request} run={run} refresh={refresh}/>}
    {manageOrganization && <RepairPanel initial={panels?.repairs} project={project} issue={group} busy={busy} request={request} run={run} refresh={refresh} />}
    {manageOrganization && <ExecutionPanel initial={panels?.execution} project={project} issue={group} event={event} busy={busy} request={request} run={run} />}
  </>;
}
