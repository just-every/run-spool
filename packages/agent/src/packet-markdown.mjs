import { markdown, TRUST } from './format.mjs';

// Keep telemetry inside code spans, even if it contains Markdown, HTML or fences.
// Summaries are deliberately short; the complete packet below preserves all data.
function inline(value) {
  const text = (Array.isArray(value) ? value.join(', ') : String(value ?? 'Unavailable')).replace(/\s+/g, ' ');
  const data = text.length > 320 ? `${text.slice(0, 320)}…` : text;
  let longest = 0;
  for (const match of data.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  const fence = '`'.repeat(longest + 1);
  const padding = data.startsWith('`') || data.endsWith('`') ? ' ' : '';
  return `${fence}${padding}${data || 'Unavailable'}${padding}${fence}`;
}

function utc(value) {
  const date = typeof value === 'number' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : 'Unavailable';
}

function release(value) {
  return value ? `${inline(value.name)}; build ${inline(value.build)}; sequence ${inline(value.sequence)}` : 'Unavailable';
}

export function packetMarkdown(packet) {
  const { issue, grouping, releaseHistory, events, gaps, bounds, verification } = packet;
  const lines = [
    TRUST, '', '# Evidence packet', '',
    `- Project: ${inline(packet.project)}`,
    `- Issue: ${inline(issue.short_id ?? issue.id)}`,
    `- Title: ${inline(issue.title)}`,
    `- State: ${inline(issue.state)}; occurrences: ${inline(issue.count)}`,
    `- First seen: ${inline(utc(issue.first_seen))}; last seen: ${inline(utc(issue.last_seen))}`,
    '', '## Grouping and releases', '',
    `- Grouping algorithm: ${inline(grouping.algorithm)}`,
    `- Grouping basis: ${inline(grouping.basis)}`,
    `- Grouping limits: ${inline(grouping.limitations)}`,
    `- First retained release: ${release(releaseHistory.first)}`,
    `- Last retained release: ${release(releaseHistory.last)}`,
    `- History basis: ${inline(releaseHistory.basis)}`,
    `- Repair verification: ${inline(verification.state)}`,
    `- Verification reason: ${inline(verification.reason)}`,
    '', '## Evidence gaps', '',
    ...gaps.map(gap => `- ${inline(gap.code)}: ${inline(gap.reason)}${gap.event ? `; event ${inline(gap.event)}` : ''}`),
    '', '## Captured events', '',
    `Included ${inline(bounds.includedEvents)} of ${inline(bounds.availableEvents)} retained events; omitted ${inline(bounds.omittedEvents)}.`,
    '',
  ];
  for (const [index, row] of events.entries()) {
    lines.push(`### Event ${index + 1}`, '',
      `- ID: ${inline(row.id)}`,
      `- Received: ${inline(utc(row.received))}`,
      `- Message: ${inline(row.event.message)}`,
      `- Release: ${release(row.release)}`,
      `- Environment: ${inline(row.environment)}`,
      `- Frame status at admission: ${inline(row.atAdmission.map(frame => frame.status))}`,
      `- Frame status now: ${inline(row.currentLookup.map(frame => frame.status))}`, '');
  }
  lines.push('## Raw data — complete packet', '', 'Summary strings may be shortened. Internal identifiers, alert payloads, full source coordinates and repair history follow as inert JSON for tools.', '',
    markdown(packet).slice(TRUST.length + 2));
  return lines.join('\n');
}
