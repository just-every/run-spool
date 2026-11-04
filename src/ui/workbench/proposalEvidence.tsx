import { date, type Request } from './shared';

export type ProposalEvidence = { issues: any[]; events: any[]; loaded: number; unavailable: number };
export type ProposalLabels = { issue: (id: string) => string; event: (id: string, occurrence?: string) => string };

// Opaque storage identities are useful for matching evidence, never as review copy.
export const proposalText = (value: unknown) => String(value ?? '')
  .replace(/audit:[a-z0-9-]+/gi, 'agent identity')
  .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[internal identifier]')
  .replace(/\b[0-9a-f]{24,}\b/gi, '[internal identifier]');

export function proposalAgent(row: any) {
  const alias = row.preparedBy ?? row.label?.replace(/^proposed by agent\s*/i, '') ?? row.actor;
  return !alias || /^audit:/i.test(alias) ? 'proposed by agent · recorded service identity' : `proposed by agent ${proposalText(alias)}`;
}

export async function loadProposalEvidence(root: string, detail: any, request: Request): Promise<ProposalEvidence> {
  const explanation = detail.explanation;
  const ids = [...new Set<string>([detail.input.source, detail.input.target,
    ...explanation.affected.map((row: any) => row.from),
    ...explanation.affected.filter((row: any) => ['applied', 'undone'].includes(detail.state) && detail.kind !== 'rule').map((row: any) => row.to),
    ...explanation.counterexamples.outside.map((row: any) => row.issue),
    ...detail.revisions.filter((row: any) => row.revision > 0).map((row: any) => row.id)
  ].filter(Boolean))];
  const [issues, packets] = await Promise.all([
    request(`${root}/issues`),
    Promise.allSettled(ids.map(id => request(`${root}/issues/${encodeURIComponent(id)}/packet`)))
  ]);
  const events: any[] = [];
  let unavailable = 0;
  for (const result of packets) {
    if (result.status === 'rejected') {
      if (result.reason?.status !== 404) throw result.reason;
      unavailable++;
      continue;
    }
    const packet = result.value;
    const index = issues.findIndex((issue: any) => issue.id === packet.issue.id);
    if (index < 0) issues.push(packet.issue); else issues[index] = packet.issue;
    events.push(...packet.events);
  }
  return { issues, events, loaded: Date.now(), unavailable };
}

export function proposalLabels(detail: any, evidence?: ProposalEvidence | null): ProposalLabels {
  const explanation = detail.explanation;
  const rows = [...explanation.affected, ...explanation.counterexamples.inside, ...explanation.counterexamples.outside];
  const keys = [...new Set(rows.map(row => `${row.event}:${row.occurrence}`))];
  const knownIssues = new Set([detail.input.source, detail.input.target,
    ...detail.revisions.filter((row: any) => row.revision > 0).map((row: any) => row.id)]);
  return {
    issue: id => {
      const issue = evidence?.issues.find(row => row.id === id);
      return issue ? proposalText(issue.short_id ?? issue.title ?? 'Issue label unavailable')
        : knownIssues.has(id) ? 'Issue label unavailable'
        : detail.kind === 'rule' ? 'Future grouping' : 'New issue';
    },
    event: (id, occurrence) => {
      const recorded = rows.find(row => row.event === id);
      const key = occurrence ? `${id}:${occurrence}` : recorded ? `${id}:${recorded.occurrence}` : '';
      const index = keys.indexOf(key);
      // Event numbers name the exact recorded occurrence without exposing its transport identity.
      return index < 0 ? 'Recorded event' : `Event ${index + 1}`;
    }
  };
}

const framePosition = (frame: any) => `${proposalText(frame.file) || 'File unavailable'}${frame.line ? `:${frame.line}` : ''}${frame.column == null ? '' : `:${frame.column}`}`;
const frameText = (frame: any) => `${proposalText(frame.function) || 'Anonymous function'} · ${framePosition(frame)}`;
const lookupLabels: Record<string, string> = { mapped: 'Original source', go_path_mapped: 'Repository path', python_source: 'Reported Python source',
  missing_debug_id: 'Generated source · no debug identity', missing_artifact: 'Generated source · source map missing', identity_mismatch: 'Generated source · source map identity mismatch',
  unmapped_position: 'Generated source · position unmapped', invalid_artifact: 'Generated source · source map unreadable',
  imported_symbolicated_stack: 'Exported source location', imported_raw_stack: 'Exported raw location',
  go_mapping_unavailable: 'Reported Go source · path mapping unavailable', go_path_unmatched: 'Reported Go source · path unmatched'
};

export function ProposalVariant({ variant, evidence, event, occurrence }: { variant: any; evidence?: ProposalEvidence | null; event?: string; occurrence?: string }) {
  let frames: any[] | null = null, structured = false;
  try { const parsed = JSON.parse(variant.stack); structured = typeof parsed === 'object'; if (Array.isArray(parsed)) frames = parsed; } catch { /* A citation can be plain stack text. */ }
  const retained = evidence?.events.find(row => event ? row.id === event && row.occurrence === occurrence
    : row.event.release === variant.release && (row.event.sentry?.transaction ?? row.event.sentry?.request?.url ?? '') === variant.route && JSON.stringify(row.event.frames) === variant.stack);
  return <div className="proposal-variant">
    <dl><div><dt>Release</dt><dd>{proposalText(variant.release) || 'No release recorded'}</dd></div><div><dt>Route</dt><dd>{proposalText(variant.route) || 'No route recorded'}</dd></div></dl>
    <strong>Current source lookup</strong>
    {retained?.currentLookup?.length ? <ol>{retained.currentLookup.map((frame: any, index: number) => <li key={index}>
      <code>{frameText(frame.original ?? frame.generated)}</code> · {lookupLabels[frame.status] ?? 'Reported source'}
    </li>)}</ol> : <p>No current lookup is available for this recorded variant in the bounded issue packets.</p>}
    <details><summary>Recorded stack snapshot</summary>
    {frames ? frames.length ? <ol>{frames.map((frame, index) => <li key={index}><code>{frameText(frame)}</code></li>)}</ol> : <p>No stack frames recorded.</p>
      : <p>{structured ? 'This citation does not contain a readable frame list.' : proposalText(variant.stack) || 'No stack cited.'}</p>}
    </details>
    {evidence && <p>Lookup read {date(evidence.loaded)}. The recorded stack snapshot above is unchanged.</p>}
  </div>;
}

export function ProposalSummary({ input, labels }: { input: any; labels: ProposalLabels }) {
  return <section aria-label="Proposed grouping change"><h4>{input.kind === 'rule' ? 'Proposed grouping rules' : 'Proposed grouping correction'}</h4>
    <p>{input.kind === 'rule' ? `Change future grouping across this project, reviewed from ${labels.issue(input.source)}. Retained events stay in their current issues.`
      : input.kind === 'merge' ? `Merge ${labels.issue(input.source)} into ${labels.issue(input.target)}.`
      : `Split ${input.events.length} selected ${input.events.length === 1 ? 'event' : 'events'} from ${labels.issue(input.source)} into a new issue.`}</p>
    {input.kind === 'rule' && <><strong>Fingerprint rules</strong><pre>{proposalText(input.policy.fingerprint) || 'No fingerprint rules.'}</pre><strong>Stack rules</strong><pre>{proposalText(input.policy.stack) || 'No stack rules.'}</pre></>}
  </section>;
}
