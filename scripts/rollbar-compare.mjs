import { createHash } from 'node:crypto';
/** Compares one Rollbar project bundle with what the owner's Spool shows after the import.
 * `native` holds owner-API reads: { issues, packets: { [issueId]: packet }, releases, alertRules }.
 * Nothing here writes; every row says whether the two sides match or the difference is explained. */
const sha256 = text => createHash('sha256').update(text).digest('hex');
const rowsOf = (bundle, kind) => (bundle.collections.find(c => c.kind === kind)?.pages ?? []).flatMap(page => page.response.result[kind]);
const plainUuid = row => row.data?.uuid?.replaceAll('-', '').toLowerCase();
function expectedFrames(instance) {
  const trace = instance.data.body.trace_chain?.[0] ?? instance.data.body.trace, language = instance.data.language;
  if (!trace) return [];
  const needsColumn = !['python', 'go'].includes(language);
  return [...trace.frames].reverse().filter(f => typeof f.filename === 'string' && Number.isSafeInteger(f.lineno) && f.lineno >= 1 && (!needsColumn || Number.isSafeInteger(f.colno) && f.colno >= 1))
    .map(f => ({ file: f.filename, line: f.lineno, column: f.colno == null ? null : f.colno - 1, function: f.method ?? '<anonymous>' }));
}
export function compareRollbarExport(bytes, native) {
  const bundle = JSON.parse(Buffer.from(bytes).toString('utf8')), organization = `rollbar:${bundle.account.slug}`, slug = bundle.project.slug;
  const items = rowsOf(bundle, 'items'), instances = rowsOf(bundle, 'instances'), deploys = rowsOf(bundle, 'deploys'), rules = rowsOf(bundle, 'rules');
  const issueId = item => sha256(JSON.stringify(['sentry', organization, slug, String(item.id)]));
  const issues = new Map(native.issues.map(issue => [issue.id, issue]));
  const nativeEvents = new Map();
  for (const packet of Object.values(native.packets)) for (const entry of packet.events) nativeEvents.set(entry.event.eventId, entry.event);
  const rows = [];
  const missingItems = items.filter(item => !issues.has(issueId(item)));
  rows.push({ aspect: 'items', source: items.length, imported: items.length - missingItems.length, status: missingItems.length ? 'differs' : 'match', missing: missingItems.map(item => String(item.id)) });
  const countDiffs = items.filter(item => issues.has(issueId(item)) && issues.get(issueId(item)).count !== instances.filter(i => String(i.item_id) === String(item.id)).length);
  const missingInstances = instances.filter(i => !nativeEvents.has(plainUuid(i)));
  const claimed = items.reduce((n, item) => n + (item.total_occurrences ?? 0), 0);
  rows.push({ aspect: 'occurrences', source: instances.length, imported: instances.length - missingInstances.length, status: missingInstances.length || countDiffs.length ? 'differs' : 'match',
    // Rollbar's own per-item totals can exceed what an export carries; the shortfall is named, not hidden.
    exportedOfClaimed: { exported: instances.length, claimedByRollbar: claimed }, explained: claimed > instances.length ? `${claimed - instances.length} occurrences are counted by Rollbar but absent from the export` : null });
  const stackDiffs = [];
  for (const instance of instances) {
    const event = nativeEvents.get(plainUuid(instance)); if (!event) continue;
    const want = expectedFrames(instance), got = event.frames.map(f => ({ file: f.file, line: f.line, column: f.column, function: f.function }));
    if (JSON.stringify(want) !== JSON.stringify(got)) stackDiffs.push({ occurrence: plainUuid(instance), source: want, imported: got });
  }
  rows.push({ aspect: 'stacks', source: instances.length, imported: instances.length - missingInstances.length, status: stackDiffs.length ? 'differs' : 'match', differences: stackDiffs });
  const revisions = new Set(deploys.map(d => d.revision).filter(Boolean)), released = new Set(native.releases.map(r => r.name));
  const missingReleases = [...revisions].filter(revision => !released.has(revision));
  rows.push({ aspect: 'deploys', source: deploys.length, imported: revisions.size - missingReleases.length, status: missingReleases.length ? 'differs' : 'explained', missing: missingReleases,
    explained: `${deploys.length} deploys become ${revisions.size} releases; environments, users and finish times stay in the private journal` });
  rows.push({ aspect: 'rules', source: rules.length, imported: native.alertRules.length, status: native.alertRules.length ? 'differs' : 'explained',
    explained: 'Notification rules are retained for review and never become live alert rules; destinations need explicit reauthorization' });
  return { ok: rows.every(row => row.status !== 'differs'), rows };
}
