import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
import type { ImportMapping, MappingResult, SourceBundle, SourceRecord } from '../../modules/import-kit/src/types.ts';
import { identity, scrub } from '../privacy.ts';
import { absentDist } from '../releases/build.ts';
import { sourceText } from '../sentry-import/source.ts';
import { nativeIssue, nativeProject } from '../sentry-import/mapping.ts';
import { bugsnagApiEvent, nativeEventId } from './event.ts';
import { bugsnagMappingVersion, bugsnagOrganizationKey } from './source.ts';
const time = (value: any) => { const n = Date.parse(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Source timestamp required'); return n; };
const effects = (targetKind: string, targetId: string, native: any, source: any): MappingResult => ({ effects: [{ targetKind, targetId, value: { native, source } }] });
const omitted = (data: any, allowed: string[]) => Object.keys(data).filter(key => !allowed.includes(key)).map(field => ({ field, reason: 'Not represented in Spool; exact source remains in the private import journal.' }));
const label = (value: unknown) => typeof value === 'string' && value ? value : Number.isSafeInteger(value) ? String(value) : undefined;
/** What each unmigratable collection becomes: named, kept as provenance, never an effect. */
export const unmigratable: Record<string, string> = {
  collaborators: 'Collaborators are never invited, granted access or notified by an import; the roster stays in the private import journal for the owner to invite deliberately.',
  symbols: 'Symbol and source-map references are kept as provenance. Spool never fetches or stores debug files from an export; upload each file again from CI to Spool (see the cutover guide).',
  integrations: 'Integrations carry credentials and outbound effects, so none is imported or activated; reauthorize each in Spool.',
  stability: 'Session timelines are historical inputs for the stability reconciliation; Spool stores no imported sessions and computes no health from them.',
};
const states: Record<string, string> = { open: 'open', in_progress: 'open', fixed: 'resolved', ignored: 'suppressed', snoozed: 'suppressed' };
/** Pure mapping: no credentials, lifecycle execution, alerts or SDK admission. */
export function bugsnagMapping(bundle: SourceBundle, operationKey: string): ImportMapping {
  sourceText(operationKey, 'import operation key');
  const occurrence = (id: string) => { const hex = sha256(JSON.stringify([operationKey, id])); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`; };
  const organization = bugsnagOrganizationKey((bundle.records.find(r => r.kind === 'manifest')?.payload as any)?.organization?.slug ?? '');
  const projects = new Map<string, any>(), errors = new Map<string, any>(), decoded = new Map<string, ReturnType<typeof bugsnagApiEvent>>();
  const projectErrors = new Map<string, string>(), errorErrors = new Map<string, string>(), eventErrors = new Map<string, string>(), releaseErrors = new Map<string, string>();
  const dists = new Map<string, Set<string>>(), counts = new Map<string, number>(), nativeIds = new Map<string, string>();
  for (const record of bundle.records) {
    const p = record.payload as any;
    if (record.kind === 'projects') { const slug = sourceText(p.data.slug, 'project slug'); if (projects.has(slug) && canonicalJson(projects.get(slug)) !== canonicalJson(p.data)) throw new Error('Conflicting project slug'); projects.set(slug, p.data); }
    if (record.kind === 'errors') errors.set(JSON.stringify([p.project, p.data.id]), p.data);
  }
  for (const [slug, data] of projects) { try { sourceText(data.name, 'project name'); time(data.created_at); } catch (error) { projectErrors.set(slug, (error as Error).message); } }
  for (const [key, data] of errors) {
    try {
      const [slug] = JSON.parse(key);
      if (!projects.has(slug) || projectErrors.has(slug)) throw new Error('Issue project is missing or rejected');
      sourceText(data.id, 'issue id'); sourceText(data.error_class, 'issue title');
      if (!(data.status in states)) throw new Error('Unsupported source issue state');
      if (time(data.first_seen) > time(data.last_seen)) throw new Error('Issue timestamps are reversed');
    } catch (error) { errorErrors.set(key, (error as Error).message); }
  }
  const addDist = (project: string, version: string, build: string) => { const key = JSON.stringify([project, version]); if (!dists.has(key)) dists.set(key, new Set()); dists.get(key)!.add(build); };
  for (const record of bundle.records.filter(r => r.kind === 'events')) {
    const p = record.payload as any;
    try {
      if (!projects.has(p.project) || projectErrors.has(p.project)) throw new Error('Event project is missing or rejected');
      const errorId = sourceText(p.data.error_id, 'event groupID');
      if (!errors.has(JSON.stringify([p.project, errorId])) || errorErrors.has(JSON.stringify([p.project, errorId]))) throw new Error('Event issue is missing or rejected');
      const id = nativeEventId(organization, p.project, sourceText(p.data.id, 'source id')); nativeIds.set(record.sourceId, id);
      const event = bugsnagApiEvent(p.data, id); decoded.set(record.sourceId, event);
      if (!event.event.release) throw new Error('Event release missing from export');
      addDist(p.project, event.event.release, event.event.build);
    } catch (error) { eventErrors.set(record.sourceId, (error as Error).message); }
  }
  // Bugsnag reports one release row per release stage; Spool's release is one version with one build.
  const canonical = new Map<string, { record: SourceRecord; created: number }>();
  for (const record of bundle.records.filter(r => r.kind === 'releases')) {
    const p = record.payload as any;
    try {
      if (!projects.has(p.project) || projectErrors.has(p.project)) throw new Error('Release project is missing or rejected');
      const name = identity(p.data.app_version, 'release'), created = time(p.data.first_released_at);
      const dist = label(p.data.app_version_code) ?? label(p.data.app_bundle_version); addDist(p.project, name, dist ?? absentDist);
      const key = JSON.stringify([p.project, name]), held = canonical.get(key);
      if (!held) canonical.set(key, { record, created });
      else { held.created = Math.min(held.created, created); if (record.sourceId < held.record.sourceId) held.record = record; }
    } catch (error) { releaseErrors.set(record.sourceId, (error as Error).message); }
  }
  const buildOf = (key: string) => [...dists.get(key) ?? []];
  const acceptedEvents = new Map<string, ReturnType<typeof bugsnagApiEvent>>(), seenEvents = new Set<string>();
  for (const record of bundle.records.filter(r => r.kind === 'events')) {
    const p = record.payload as any, event = decoded.get(record.sourceId); if (!event) continue;
    const key = JSON.stringify([p.project, event.event.release]);
    if (!canonical.has(key)) { eventErrors.set(record.sourceId, 'Event release missing from export'); continue; }
    if (buildOf(key).length > 1) { eventErrors.set(record.sourceId, 'Multiple distributions for one release are outside the native release contract'); continue; }
    acceptedEvents.set(record.sourceId, event);
    if (!seenEvents.has(record.sourceId)) { seenEvents.add(record.sourceId); const group = JSON.stringify([p.project, p.data.error_id]); counts.set(group, (counts.get(group) ?? 0) + 1); }
  }
  const seqs = new Map<string, number>();
  for (const slug of projects.keys()) {
    const names = [...canonical.entries()].filter(([key]) => JSON.parse(key)[0] === slug).sort((a, b) => a[1].created - b[1].created || a[0].localeCompare(b[0]));
    names.forEach(([key], index) => seqs.set(key, index + 1));
  }
  const releaseAllowed = ['id', 'app_version', 'app_version_code', 'app_bundle_version', 'first_released_at', 'release_stage_name', 'total_sessions_count', 'unhandled_sessions_count'];
  return { version: bugsnagMappingVersion, map(record: SourceRecord): MappingResult {
    const p = record.payload as any, data = p.data;
    if (record.kind === 'manifest') return { effects: [], unmapped: [{ reason: 'Export window, declared omissions and organization metadata are retained for review; no account or credentials are created.' }] };
    try {
      if (record.kind in unmigratable) return { effects: [], unmapped: [{ reason: unmigratable[record.kind] }] };
      if (record.kind === 'projects') {
        const parent = projectErrors.get(data.slug); if (parent) throw new Error(parent);
        const slug = sourceText(data.slug, 'project slug'), id = nativeProject(organization, slug);
        const result = effects('project', id, { id, name: scrub(sourceText(data.name, 'project name')), created: time(data.created_at) }, { organization, project: slug, id: sourceText(data.id, 'project id') });
        result.unmapped = omitted(data, ['id', 'slug', 'name', 'created_at']); return result;
      }
      if (!['releases', 'errors', 'events'].includes(record.kind)) return { effects: [], unmapped: [{ reason: 'Unsupported collection retained in the private source journal, without native effects.' }] };
      if (!projects.has(p.project)) throw new Error('Source project missing');
      const project = nativeProject(organization, p.project);
      if (record.kind === 'releases') {
        const parent = releaseErrors.get(record.sourceId); if (parent) throw new Error(parent);
        const name = identity(data.app_version, 'release'), key = JSON.stringify([p.project, name]), held = canonical.get(key)!;
        const result: MappingResult = { effects: [], unmapped: omitted(data, releaseAllowed) };
        result.unmapped!.push({ field: 'sessions', reason: 'Session counts are historical stability inputs shown in the import reconciliation; Spool stores no imported sessions and computes no health from them.' });
        if (buildOf(key).length > 1) throw new Error('Multiple distributions for one release are outside the native release contract');
        if (held.record.sourceId !== record.sourceId) { result.unmapped!.push({ field: 'release_stage_name', reason: 'The same app version in another release stage; one native release covers every stage and the stage stays in the private journal.' }); return result; }
        result.effects.push(...effects('release', JSON.stringify([project, name]), { project, name, seq: seqs.get(key)!, build: buildOf(key)[0] ?? absentDist, created: held.created }, { organization, project: p.project, id: name }).effects);
        return result;
      }
      if (record.kind === 'errors') {
        const parent = errorErrors.get(JSON.stringify([p.project, data.id])); if (parent) throw new Error(parent);
        const sourceId = sourceText(data.id, 'issue id'), id = nativeIssue(organization, p.project, sourceId), fingerprint = sha256(JSON.stringify(['sentry-import', organization, p.project, sourceId]));
        const state = states[data.status], sampled = counts.get(JSON.stringify([p.project, sourceId])) ?? 0;
        const ceiling = Math.max(0, ...[...seqs].filter(([key]) => JSON.parse(key)[0] === p.project).map(([, seq]) => seq));
        const title = scrub(sourceText(`${data.error_class}${typeof data.message === 'string' && data.message ? `: ${data.message}` : ''}`.slice(0, 200), 'issue title'));
        const total = Number.isSafeInteger(data.events) && data.events >= sampled ? data.events : sampled;
        const result = effects('issue', id, { id, project, fingerprint, algorithm: 'sentry-import-v1', title, state, revision: 1, count: total, first_seen: time(data.first_seen), last_seen: time(data.last_seen), resolved_seq: state === 'resolved' ? ceiling : null, latest_release_seq: ceiling }, { organization, project: p.project, id: sourceId });
        result.unmapped = omitted(data, ['id', 'error_class', 'message', 'status', 'first_seen', 'last_seen', 'events']);
        if (data.status === 'snoozed') result.unmapped.push({ field: 'status', reason: 'A snooze rule (time or threshold) is not imported; the issue is suppressed until the owner reopens it.' });
        if (data.assigned_collaborator_id) result.unmapped.push({ field: 'assigned_collaborator_id', reason: 'Assignment is triage authority; collaborators are never invited by an import, so the assignee is kept only in the private journal.' });
        return result;
      }
      const event = acceptedEvents.get(record.sourceId); if (!event) throw new Error(eventErrors.get(record.sourceId) ?? 'Event unavailable');
      const issue = nativeIssue(organization, p.project, data.error_id), id = nativeIds.get(record.sourceId)!, { event: envelope, received } = event, payload = JSON.stringify(envelope);
      const diagnostic = JSON.stringify(envelope.frames.map(generated => ({ generated, status: 'imported_raw_stack', source: 'bugsnag-api-export' })));
      const result = effects('event', JSON.stringify([project, id]), { id, project, issue, release: envelope.release, release_seq: seqs.get(JSON.stringify([p.project, envelope.release]))!, build: envelope.build, environment: envelope.environment, payload, digest: sha256(canonicalJson(envelope)), diagnostic, received, occurrence: occurrence(record.sourceId), historical: 1 }, { organization, project: p.project, id });
      result.unmapped = [...omitted(data, ['id', 'error_id', 'received_at', 'app', 'device', 'exceptions', 'breadcrumbs', 'unhandled', 'severity']),
        { field: 'user', reason: 'The affected-user identity and request, device and metadata fields stay out of native events; only exception locations, breadcrumb labels, the app version, release stage and OS name are kept.' },
        { field: 'stacktrace', reason: 'The stack is exactly as the notifier sent it. Native frames keep their image, addresses and symbol; Spool has no uploaded debug files for them, so none is symbolicated.' }];
      return result;
    } catch (error) { return { effects: [], rejection: (error as Error).message }; }
  } };
}
