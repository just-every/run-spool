import { useId, useState } from 'react';
import { Details } from './Details';
import { GroupingFacts } from './GroupingExplanation';
import { RepositorySource } from './RepositorySource';
import { SentryEvent } from './SentryEvent';
import { IconButton } from './Tip';
import { displayFile } from './shared';

/** Where it broke, first: the frames in one bordered list, the first frame on sunk fill, each frame's repository
 * line one tap away. Grouping and source evidence sit behind the two controls beside the frame count. */
export function StackTrace({ packet, event, grouping, readOnly, onUpload }: { packet: any; event: any; grouping: any; readOnly: boolean; onUpload: (release: string, debugId: string) => void }) {
  const [allFrames, setAllFrames] = useState(false);
  const group = packet.issue, frames: any[] = event?.currentLookup ?? [];
  const missing = frames.filter(frame => !['mapped', 'go_path_mapped', 'python_source'].includes(frame.status));
  const language = event?.event.language, imported = event?.historical === true, sample = event?.event.environment === 'spool-test';
  return <section className="evidence stack-section issue" aria-labelledby="stack-title">
    <div className="section-head"><h2 id="stack-title">Stack trace</h2><span className="meta">{frames.length} {frames.length === 1 ? 'frame' : 'frames'}</span>
      {event && !event.event.sentry && <Details icon="group" title="Event grouping information"><GroupingFacts grouping={grouping} event={event.event} /></Details>}
      <Details icon="info" title="Issue and source evidence"><p>Source maps and recorded repository path mappings enrich the current lookup. Original receipt records remain unchanged.</p><pre>{JSON.stringify({ issue: group, grouping: packet.grouping, events: packet.events }, null, 2)}</pre></Details>
    </div>
    {event?.event.sentry && <SentryEvent data={event.event.sentry} grouping={grouping} />}
    {sample && <p className="callout"><strong>Spool’s sample error.</strong> This stack comes from the Send test error button in Spool. It checks that your key and release can receive an error. It does not need a source map from your app.</p>}
    {packet.events?.some((occurrence: any) => occurrence.event.exceptionSource === 'parsed-text') && <p className="callout">Exception type and frames were parsed from text for some events. Message text can imitate a traceback; these are best-effort reported locations.</p>}
    {imported && <p className="callout">Imported historical evidence. {frames.some(frame => frame.status === 'imported_symbolicated_stack') ? 'These locations were already symbolicated in the export; Spool has not verified their generated positions.' : 'These raw stack locations come from the export.'} This history does not trigger alerts or join live capture groups.</p>}
    {language && <p className="callout">{language === 'python' ? event?.event.sentry ? 'Python paths are reported source coordinates. Source-map symbolication is unavailable; SDK context above is retained as sent.' : 'Python reported source paths. Source content and symbolication are unavailable.' : 'Go reported source paths. Recorded release prefixes can map to repository paths; binary and DWARF symbolication are unavailable.'} The sandbox reproducer supports JavaScript only.</p>}
    {language === 'go' && !!missing.length && <p className="callout">{missing.some(frame => frame.status === 'go_mapping_unavailable') ? 'No path mappings are recorded for this release, build and environment. Register a deployment manifest with path mappings in Releases.' : 'Some reported paths do not match the recorded deployment prefixes.'}</p>}
    {!language && !imported && !sample && !!missing.length && <div className="callout missing-map"><strong>Original source unavailable for {missing.length === 1 ? 'one frame' : `${missing.length} frames`}</strong><p>{missing.some(frame => frame.status === 'missing_debug_id') ? 'Some frames have no debug ID. Add the bundle’s debug ID to capture and upload its matching map.' : missing.every(frame => ['unmapped_position', 'invalid_artifact'].includes(frame.status)) ? 'The stored map could not locate these positions. Check the generated coordinates and map diagnostics in Details.' : 'Upload the map matching this release, build and debug ID to locate the original source.'}</p>{!readOnly && <button className="text-button" onClick={() => onUpload(event.event.release, missing.find(frame => frame.generated.debugId)?.generated.debugId ?? '')}>Upload map</button>}</div>}
    {event?.event.sentry && <h3>Primary exception source lookup</h3>}
    <ol className="stack frame-list">{frames.slice(0, allFrames ? 30 : 6).map((frame, index) => <Frame key={index} frame={frame} index={index} sample={sample} language={language} source={event?.repositorySources?.[index]} library={!event?.event.sentry && grouping?.frames?.[index]?.inApp === false} />)}</ol>
    {!frames.length && <p>No retained stack frames.</p>}
    {frames.length > 6 && <button className="text-button" onClick={() => setAllFrames(!allFrames)}>{allFrames ? 'Show fewer frames' : `Show all ${frames.length} frames`}</button>}
  </section>;
}

function Frame({ frame, index, sample, language, source, library }: { frame: any; index: number; sample: boolean; language?: string; source: any; library: boolean }) {
  const [open, setOpen] = useState(false), more = useId();
  const mapped = ['mapped', 'go_path_mapped'].includes(frame.status), position = mapped ? frame.original : frame.generated;
  const label = sample ? 'Spool sample' : frame.status === 'go_path_mapped' ? 'Repository path' : language ? 'Reported source' : mapped ? 'Original source' : frame.status === 'imported_symbolicated_stack' ? 'Exported symbolicated location' : frame.status === 'imported_raw_stack' ? 'Exported raw location' : 'Generated source';
  const rowClass = `stack-row ${mapped ? 'mapped-frame' : 'generated-frame'}${index ? '' : ' first-frame'}${open ? ' open' : ''}`;
  const row = <>
    <span className="line-no" aria-hidden="true">{index + 1}.</span>
    <div className="frame-text">{position.function ? <code className="frame-function">{position.function}</code> : <span className="frame-function">Anonymous function</span>}<code className="frame-coordinate">{displayFile(position.file)}:{position.line}{position.column == null ? '' : `:${position.column}`}</code></div>
    <span className="frame-source">{label}</span>
    <IconButton icon="down" className="frame-toggle" label={`Frame ${index + 1} details`} aria-expanded={open} aria-controls={more} onClick={() => setOpen(value => !value)} />
    <div id={more} className="frame-more" hidden={!open}><RepositorySource source={source} />{mapped && <span className="meta">Generated position <code>{displayFile(frame.generated.file)}:{frame.generated.line}{frame.generated.column == null ? '' : `:${frame.generated.column}`}</code></span>}</div>
  </>;
  return library ? <li><details><summary>Library frame · not in app</summary><div className={rowClass}>{row}</div></details></li> : <li className={rowClass}>{row}</li>;
}
