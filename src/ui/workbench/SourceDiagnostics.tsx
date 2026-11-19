import { Details } from './Details';
import { buildLabel, releaseLabel } from './releaseLabels';
import { date, displayFile, download } from './shared';
import './SourceDiagnostics.css';

type Position = { file: string; line: number | null; column?: number | null; function?: string | null };
type Lookup = { generated: Position; original?: Position; status: string };
type Occurrence = {
  id: string;
  occurrence: string;
  received: number;
  event: { release: string; build: string };
  atAdmission: Lookup[];
  currentLookup: Lookup[];
  grouping?: unknown;
  originalGrouping?: unknown;
};

const reasons: Record<string, string> = {
  mapped: 'Mapped to original source.',
  missing_debug_id: 'The frame has no debug ID to select a source map.',
  missing_artifact: 'No source map matches this release, build and debug ID.',
  identity_mismatch: 'The debug ID belongs to a different release or build.',
  unmapped_position: 'The matching map has no original position for this location.',
  invalid_artifact: 'The stored source map could not be read.',
  missing_native_symbols: 'No Android mapping matches this release and build.',
  native_symbol_identity_mismatch: 'The Android mapping belongs to a different build.',
  native_symbol_unmapped: 'The Android mapping has no matching method and line.',
  native_symbol_ambiguous: 'The Android mapping identifies more than one possible original location.',
  native_symbol_source_unavailable: 'The Android mapping has no original filename.',
  invalid_native_symbols: 'The stored Android mapping could not be read.',
  python_source: 'Source location reported by Python.',
  go_path_mapped: 'Matched a recorded Go repository path.',
  go_mapping_unavailable: 'No Go path mapping matches this deployment.',
  go_path_unmatched: 'The Go source path matches no recorded prefix.',
  imported_symbolicated_stack: 'Original location supplied by the imported archive.',
  imported_raw_stack: 'Stack location supplied by the imported archive.',
};

function coordinate(position: Position) {
  return `${displayFile(position.file)}${position.line == null ? '' : `:${position.line}`}${position.column == null ? '' : `:${position.column}`}`;
}

export function SourceDiagnostics({ occurrence, hidden, packet }: { occurrence?: Occurrence; hidden: Set<number>; packet: { issue: { short_id?: string }; grouping: unknown } }) {
  const frames = occurrence?.currentLookup.map((frame, index) => ({ frame, index })).filter(({ index }) => !hidden.has(index)) ?? [];
  function exportEvidence() {
    const event = occurrence && {
      id: occurrence.id,
      occurrence: occurrence.occurrence,
      received: occurrence.received,
      release: occurrence.event.release,
      build: occurrence.event.build,
      grouping: occurrence.grouping ?? occurrence.originalGrouping,
      atAdmission: occurrence.atAdmission,
      currentLookup: occurrence.currentLookup,
    };
    download({ issue: packet.issue, grouping: packet.grouping, event }, `spool-${packet.issue.short_id ?? 'issue'}-source-evidence.json`);
  }
  return <Details title="Issue and source evidence">
    {occurrence && <p>{releaseLabel(occurrence.event.release)} · {buildLabel(occurrence.event.build)} · Received {date(occurrence.received)}</p>}
    {frames.length ? <ol className="source-diagnostics">{frames.map(({ frame, index }) => {
      const admitted = occurrence?.atAdmission[index];
      const original = frame.original && coordinate(frame.original);
      const receipt = admitted?.original && coordinate(admitted.original);
      return <li key={index}>
        <h3>{frame.generated.function || 'Anonymous function'}</h3>
        <dl>
          <div><dt>Generated</dt><dd><code>{coordinate(frame.generated)}</code></dd></div>
          {original && <div><dt>Original</dt><dd><code>{original}</code></dd></div>}
          <div><dt>At receipt</dt><dd>{(admitted && reasons[admitted.status]) || 'No source lookup recorded.'}
            {receipt && receipt !== original && <> <code>{receipt}</code></>}
          </dd></div>
          <div><dt>Current lookup</dt><dd>{reasons[frame.status] ?? 'Source lookup unavailable.'}</dd></div>
        </dl>
      </li>;
    })}</ol> : <p>No retained stack frames to diagnose.</p>}
    <button className="text-button" onClick={exportEvidence}>Download raw evidence</button>
  </Details>;
}
