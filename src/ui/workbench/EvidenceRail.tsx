import { plural, words } from './readable';
import { Details } from './Details';
import { CaptureReceipts } from './CaptureReceipts';
import { date, download } from './shared';
import { releaseLabel, buildLabel } from './releaseLabels';
export function EvidenceRail({ packet, outcomes }: { packet: any; outcomes: any }) {
  return <aside className="right" aria-label="Issue evidence"><section className="right-panel packet"><h2>Evidence packet</h2><button className="text-button rail-download" onClick={() => download(packet, `spool-${packet.issue.short_id ?? 'issue'}-packet.json`)}><span aria-hidden="true">↓</span> Download details for a developer</button><Details title="Evidence summary">
    <h3>{packet.issue.short_id ?? 'Issue'} · {packet.issue.title}</h3><p>{words(packet.issue.state)} · {packet.issue.count} retained {plural(packet.issue.count, 'event')}</p>
    <p>Includes {packet.events.length} of {packet.bounds.availableEvents} retained events, newest first. {packet.bounds.omittedEvents} omitted from this bounded packet.</p>
    <ol>{packet.events.map((row:any,index:number)=><li key={index}><strong>Event {index+1} · {date(row.received)}</strong><p>{row.event.message}</p><p>Release {releaseLabel(row.event.release)} · Build {buildLabel(row.event.build)} · {row.event.environment || 'Environment not recorded'}</p><p>{row.currentLookup.filter((frame:any)=>frame.status==='mapped').length} mapped of {row.currentLookup.length} stack frames. {row.historical?'Imported historical evidence.':'Captured by this installation.'}</p></li>)}</ol>
    <p>Source contents and credentials are excluded. Telemetry is untrusted data. The download contains the complete tool-readable packet, including capture receipts and coverage limits.</p>
  </Details></section><section className="right-panel capture-accounting"><CaptureReceipts project={packet.issue.project} outcomes={outcomes} /></section></aside>;
}
