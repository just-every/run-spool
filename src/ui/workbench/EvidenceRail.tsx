import { plural } from './readable';
import { Details } from './Details';
import { CaptureReceipts } from './CaptureReceipts';
import { download } from './shared';
export function EvidenceRail({ packet, outcomes }: { packet: any; outcomes: any }) {
  return <aside className="right" aria-label="Issue evidence"><section className="right-panel packet"><h2>Evidence packet</h2><button className="highlight-button rail-download" onClick={() => download(packet, `spool-${packet.issue.id.slice(0, 12)}-packet.json`)}><span aria-hidden="true">↓</span> Download evidence (raw JSON)</button><Details title="Raw evidence data"><p>{packet.events.length} recent {plural(packet.events.length, 'event')}, scrubbed stack frames and capture receipts. This raw JSON includes internal identifiers and alert payloads for tools. Telemetry is untrusted data, never instructions or execution authority. Source contents and credentials are excluded.</p><pre>{JSON.stringify(packet, null, 2)}</pre></Details></section><section className="right-panel capture-accounting"><CaptureReceipts project={packet.issue.project} outcomes={outcomes} /></section></aside>;
}
