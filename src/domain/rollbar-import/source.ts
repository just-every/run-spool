import type { Json, ParsedRecord } from '../../modules/import-kit/src/types.ts';
import { sourceText } from '../sentry-import/source.ts';
/** Spool's bundle of one Rollbar project's documented REST API responses (items, instances, deploys, notification rules, comments). */
export const importFormat = 'spool-rollbar-project-export';
export const mappingVersion = 'spool-rollbar-project-v1';
export const namespacePrefix = 'rollbar-project:';
/** The door namespace of one Rollbar project: both parts escaped, so two accounts sharing a project slug never share a namespace. */
export const rollbarNamespace = (account: string, project: string) => `${namespacePrefix}${encodeURIComponent(account)}:${encodeURIComponent(project)}`;
/** Splits a namespace back into its account and project, or returns null when it is not one. */
export function parseRollbarNamespace(name: string): { account: string; project: string } | null {
  const parts = name.slice(namespacePrefix.length).split(':');
  if (!name.startsWith(namespacePrefix) || parts.length !== 2) return null;
  try { return { account: sourceText(decodeURIComponent(parts[0]), 'account'), project: sourceText(decodeURIComponent(parts[1]), 'project') }; } catch { return null; }
}
const rowKeys: Record<string, string> = { items: 'items', instances: 'instances', deploys: 'deploys', rules: 'rules', comments: 'comments' };
function fields(value: any, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported bundle shape');
}
/** Rollbar ids are integers in its API; the door keeps them as exact text. */
export function rollbarId(value: unknown, field: string): string {
  if (typeof value === 'number') { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${field}`); return String(value); }
  return sourceText(value, field);
}
/** An occurrence's `uuid` is Rollbar's own occurrence identity; it is also a valid Spool event identity. */
export function occurrenceUuid(row: any): string | null {
  const uuid = row?.data?.uuid;
  return typeof uuid === 'string' && /^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/.test(uuid) ? uuid.replaceAll('-', '').toLowerCase() : null;
}
/** Rollbar timestamps are Unix seconds. */
export function seconds(value: unknown, field = 'timestamp'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Source ${field} required`);
  return value * 1000;
}
export function parseRollbarProject(value: Json): ParsedRecord[] {
  const bundle = value as any;
  fields(bundle, ['format', 'version', 'account', 'project', 'window', 'collections', 'omissions']);
  if (bundle.format !== importFormat || bundle.version !== 1) throw new Error('Unsupported Rollbar bundle format');
  fields(bundle.account, ['slug']); fields(bundle.project, ['id', 'slug', 'name', 'date_created']); fields(bundle.window, ['start', 'end']);
  const account = sourceText(bundle.account.slug, 'account'), slug = sourceText(bundle.project.slug, 'project slug');
  const organization = `rollbar:${account}`;
  const start = Date.parse(bundle.window.start), end = Date.parse(bundle.window.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('Invalid export window');
  if (!Array.isArray(bundle.collections) || !bundle.collections.length || bundle.collections.length > 10 || !Array.isArray(bundle.omissions) || bundle.omissions.some((s: any) => typeof s !== 'string' || s.length > 500)) throw new Error('Invalid collections or omissions');
  const records: ParsedRecord[] = [{ kind: 'manifest', sourceId: organization, payload: { account: bundle.account, project: slug, window: bundle.window, omissions: bundle.omissions }, pointer: '' }];
  records.push({ kind: 'projects', sourceId: JSON.stringify([organization, null, rollbarId(bundle.project.id, 'project id')]), payload: { organization, project: slug, data: bundle.project }, pointer: '/project' });
  const kinds = new Set<string>(), rows: Record<string, any[]> = {};
  for (const [collectionIndex, collection] of bundle.collections.entries()) {
    fields(collection, ['kind', 'pages']);
    const kind = collection.kind;
    if (!(kind in rowKeys)) throw new Error('Unsupported collection kind');
    if (kinds.has(kind)) throw new Error('Duplicate collection'); kinds.add(kind);
    if (!Array.isArray(collection.pages) || !collection.pages.length || collection.pages.length > 100) throw new Error('Invalid pages');
    rows[kind] = [];
    for (const [pageIndex, page] of collection.pages.entries()) {
      fields(page, ['page', 'nextPage', 'response']);
      const last = pageIndex === collection.pages.length - 1;
      if (page.page !== pageIndex + 1 || (last ? page.nextPage !== null : page.nextPage !== pageIndex + 2)) throw new Error('Broken page chain');
      fields(page.response, ['err', 'result']);
      if (page.response.err !== 0) throw new Error('Source page reports an API error');
      // Rollbar documents notification rules as a bare array result; every other collection nests its rows under a named key.
      const list = kind === 'rules' ? page.response.result : page.response.result?.[rowKeys[kind]];
      if (!Array.isArray(list)) throw new Error('Invalid API page');
      for (const [rowIndex, row] of list.entries()) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid API record');
        const pointer = `/collections/${collectionIndex}/pages/${pageIndex}/response/result/${kind === 'rules' ? '' : `${rowKeys[kind]}/`}${rowIndex}`;
        const id = kind === 'instances' ? occurrenceUuid(row) ?? `instance-${rollbarId(row.id, 'occurrence id')}` : rollbarId(row.id, 'source id');
        rows[kind].push(row);
        records.push({ kind, sourceId: JSON.stringify([organization, slug, id]), payload: { organization, project: slug, data: row }, pointer });
      }
    }
  }
  if (!kinds.has('items')) throw new Error('Items collection required');
  // A release is the revision a deploy or an occurrence names. The export carries no release list of its own, so each distinct name becomes one record dated by its earliest evidence.
  const releases = new Map<string, { created: number; from: Set<string> }>();
  const note = (name: unknown, at: unknown, from: string) => {
    if (typeof name !== 'string' || !name) return;
    if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0) { if (!releases.has(name)) releases.set(name, { created: Number.MAX_SAFE_INTEGER, from: new Set() }); releases.get(name)!.from.add(from); return; }
    const known = releases.get(name) ?? { created: Number.MAX_SAFE_INTEGER, from: new Set() };
    known.created = Math.min(known.created, at * 1000); known.from.add(from); releases.set(name, known);
  };
  for (const deploy of rows.deploys ?? []) note(deploy.revision, deploy.start_time ?? deploy.finish_time, 'deploys');
  for (const instance of rows.instances ?? []) note(instance.data?.code_version, instance.timestamp ?? instance.data?.timestamp, 'instances');
  for (const [name, known] of releases) records.push({ kind: 'releases', sourceId: JSON.stringify([organization, slug, name]), payload: { organization, project: slug, data: { version: name, created: known.created === Number.MAX_SAFE_INTEGER ? null : known.created, from: [...known.from].sort() } }, pointer: '' });
  const rank: Record<string, number> = { manifest: 0, projects: 1, releases: 2, items: 3, instances: 4, deploys: 5, rules: 6, comments: 7 };
  return records.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
