import { sha256, canonicalJson } from '../../modules/import-kit/src/provenance/identity.ts';
import type { ImportMapping, MappingResult, SourceBundle, SourceRecord } from '../../modules/import-kit/src/types.ts';
import { identity, scrub } from '../privacy.ts';
import { absentDist } from '../releases/build.ts';
import { nativeProject, nativeIssue } from '../sentry-import/mapping.ts';
import { sourceText } from '../sentry-import/source.ts';
import { rollbarEvent } from './occurrence.ts';
import { mappingVersion, rollbarId, seconds } from './source.ts';
const effects = (targetKind: string, targetId: string, native: any, source: any): MappingResult => ({ effects: [{ targetKind, targetId, value: { native, source } }] });
const omitted = (data: any, allowed: string[]) => Object.keys(data).filter(key => !allowed.includes(key)).map(field => ({ field, reason: 'Not represented in Spool; exact source remains in the private import journal.' }));
const states: Record<string, string> = { active: 'open', resolved: 'resolved', muted: 'suppressed', archived: 'suppressed' };
/** Pure mapping: no credentials, lifecycle execution, alerts or SDK admission. Deploys, notification
 * rules and comments never become native rows; they are retained in the private journal and named. */
export function projectMapping(bundle: SourceBundle, operationKey: string): ImportMapping {
  sourceText(operationKey, 'import operation key');
  const occurrence = (id: string) => { const hex = sha256(JSON.stringify([operationKey, id])); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`; };
  const items = new Map<string, any>(), itemErrors = new Map<string, string>(), releaseErrors = new Map<string, string>(), releases = new Map<string, any>();
  let projectError: string | undefined, slug = '';
  for (const record of bundle.records) {
    const p = record.payload as any;
    if (record.kind === 'projects') { slug = p.project; try { sourceText(p.data.name, 'project name'); seconds(p.data.date_created, 'project date_created'); } catch (error) { projectError = (error as Error).message; } }
  }
  for (const record of bundle.records.filter(r => r.kind === 'items')) {
    const p = record.payload as any, data = p.data;
    try {
      if (projectError) throw new Error('Item project is rejected');
      rollbarId(data.id, 'item id'); sourceText(data.title, 'item title');
      if (!states[data.status]) throw new Error('Unsupported source item status');
      if (seconds(data.first_occurrence_timestamp, 'first occurrence') > seconds(data.last_occurrence_timestamp, 'last occurrence')) throw new Error('Item timestamps are reversed');
      items.set(rollbarId(data.id, 'item id'), data);
    } catch (error) { itemErrors.set(record.sourceId, (error as Error).message); }
  }
  for (const record of bundle.records.filter(r => r.kind === 'releases')) {
    const data = (record.payload as any).data;
    try {
      if (projectError) throw new Error('Release project is rejected');
      if (data.created === null) throw new Error('Release has no dated deploy or occurrence');
      if (identity(data.version, 'release') !== data.version) throw new Error('Release name is outside the native release contract');
      releases.set(data.version, data);
    } catch (error) { releaseErrors.set(record.sourceId, (error as Error).message); }
  }
  const seqs = new Map<string, number>();
  [...releases.values()].sort((a, b) => a.created - b.created || a.version.localeCompare(b.version)).forEach((data, index) => seqs.set(data.version, index + 1));
  const decoded = new Map<string, ReturnType<typeof rollbarEvent>>(), eventErrors = new Map<string, string>(), counts = new Map<string, number>();
  for (const record of bundle.records.filter(r => r.kind === 'instances')) {
    const p = record.payload as any;
    try {
      if (projectError) throw new Error('Occurrence project is rejected');
      const itemId = rollbarId(p.data.item_id, 'occurrence item_id');
      if (!items.has(itemId)) throw new Error('Occurrence item is missing or rejected');
      const version = p.data.data?.code_version, release = typeof version === 'string' && releases.has(version) ? version : undefined;
      const result = rollbarEvent(p.data, release);
      decoded.set(record.sourceId, result);
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    } catch (error) { eventErrors.set(record.sourceId, (error as Error).message); }
  }
  const ceiling = Math.max(0, ...seqs.values());
  return { version: mappingVersion, map(record: SourceRecord): MappingResult {
    const p = record.payload as any, data = p.data;
    if (record.kind === 'manifest') return { effects: [], unmapped: [{ reason: 'Export window, declared omissions and account metadata are retained for review; no account, member or credential is created.' }, ...(data?.omissions ?? p.omissions ?? []).map((reason: string) => ({ field: 'omission', reason }))] };
    try {
      const org = p.organization;
      if (record.kind === 'projects') {
        if (projectError) throw new Error(projectError);
        const id = nativeProject(org, slug), result = effects('project', id, { id, name: scrub(sourceText(data.name, 'project name')), created: seconds(data.date_created, 'project date_created') }, { organization: org, project: slug, id: rollbarId(data.id, 'project id') });
        result.unmapped = omitted(data, ['id', 'slug', 'name', 'date_created']); return result;
      }
      if (record.kind === 'releases') {
        const error = releaseErrors.get(record.sourceId); if (error) throw new Error(error);
        const project = nativeProject(org, slug), result = effects('release', JSON.stringify([project, data.version]), { project, name: data.version, seq: seqs.get(data.version)!, build: absentDist, created: data.created }, { organization: org, project: slug, id: data.version });
        result.unmapped = [{ field: 'from', reason: `Release inferred from ${data.from.join(' and ')}; Rollbar exports no release list.` }]; return result;
      }
      if (record.kind === 'items') {
        const error = itemErrors.get(record.sourceId); if (error) throw new Error(error);
        const sourceId = rollbarId(data.id, 'item id'), id = nativeIssue(org, slug, sourceId), project = nativeProject(org, slug);
        const state = states[data.status], fingerprint = sha256(JSON.stringify(['sentry-import', org, slug, sourceId]));
        const result = effects('issue', id, { id, project, fingerprint, algorithm: 'sentry-import-v1', title: scrub(sourceText(data.title, 'item title')), state, revision: 1, count: counts.get(sourceId) ?? 0,
          first_seen: seconds(data.first_occurrence_timestamp, 'first occurrence'), last_seen: seconds(data.last_occurrence_timestamp, 'last occurrence'), resolved_seq: state === 'resolved' ? ceiling : null, latest_release_seq: ceiling }, { organization: org, project: slug, id: sourceId });
        result.unmapped = omitted(data, ['id', 'title', 'status', 'first_occurrence_timestamp', 'last_occurrence_timestamp']).filter(row => !['assigned_user_id', 'integrations_data', 'hash', 'last_resolved_timestamp', 'last_activated_timestamp', 'resolved_in_version'].includes(row.field!));
        if (data.assigned_user_id != null) result.unmapped.push({ field: 'assigned_user_id', reason: 'Assignment names a Rollbar user; Spool assigns teammates, so nobody is assigned and the source user id stays in the private journal.' });
        if (Array.isArray(data.integrations_data) ? data.integrations_data.length : data.integrations_data) result.unmapped.push({ field: 'integrations_data', reason: 'Tracker links are retained in the private journal only; no tracker is contacted or linked.' });
        if (data.hash != null) result.unmapped.push({ field: 'hash', reason: 'Rollbar grouping fingerprint is retained in the private journal; the imported issue keeps its own grouping and live events never merge into it.' });
        if (data.status === 'active' && typeof data.last_resolved_timestamp === 'number') result.unmapped.push({ field: 'last_resolved_timestamp', reason: 'Reactivated after resolution: imported as open, with the earlier resolution time kept in the private journal.' });
        if (data.status === 'resolved' && data.resolved_in_version) result.unmapped.push({ field: 'resolved_in_version', reason: 'Resolved boundary is the newest imported release; the named fix version stays in the private journal.' });
        if (data.status === 'archived') result.unmapped.push({ field: 'status', reason: 'Archived is imported as suppressed; Spool has no archive state.' });
        return result;
      }
      if (record.kind === 'instances') {
        const result = decoded.get(record.sourceId); if (!result) throw new Error(eventErrors.get(record.sourceId) ?? 'Occurrence unavailable');
        const { event, received, located, total } = result, project = nativeProject(org, slug), issue = nativeIssue(org, slug, rollbarId(data.item_id, 'occurrence item_id')), payload = JSON.stringify(event);
        const diagnostic = JSON.stringify(event.frames.map(generated => ({ generated, status: 'imported_raw_stack', source: 'rollbar-api-export' })));
        const out = effects('event', JSON.stringify([project, event.eventId]), { id: event.eventId, project, issue, release: event.release, release_seq: event.release ? seqs.get(event.release)! : 0, build: event.build, environment: event.environment, payload, digest: sha256(canonicalJson(event)), diagnostic, received, occurrence: occurrence(record.sourceId), historical: 1 }, { organization: org, project: slug, id: event.eventId });
        out.unmapped = [{ field: 'data', reason: 'Only exception locations and telemetry labels are scrubbed into evidence. Person, request, server, custom data, code context and the custom fingerprint stay out of native events and remain in the private journal.' }];
        if (located < total) out.unmapped.push({ field: 'stack', reason: `${total - located} of ${total} frames lack a file, line or column and were not carried.` });
        if (typeof data.data?.code_version === 'string' && !event.release) out.unmapped.push({ field: 'code_version', reason: 'Occurrence names a release Spool cannot hold; it is imported release-less.' });
        return out;
      }
      if (record.kind === 'deploys') return { effects: [], unmapped: [{ field: 'deploy', reason: 'The deploy revision is imported as a release; its environment, status, user, comment and finish time are retained in the private journal and no deploy record is created.' }] };
      if (record.kind === 'rules') return { effects: [], unmapped: [{ field: 'rule', reason: 'Notification rules never become live alert rules from an import: channels and destinations need explicit reauthorization. The trigger, filters and channel stay in the private journal for review.' }] };
      if (record.kind === 'comments') return { effects: [], unmapped: [{ field: 'comment', reason: 'Comments are retained in the private journal; an import never writes discussion authored in a teammate\'s name.' }] };
      return { effects: [], unmapped: [{ reason: 'Unsupported collection retained in the private source journal, without native effects.' }] };
    } catch (error) { return { effects: [], rejection: (error as Error).message }; }
  } };
}
