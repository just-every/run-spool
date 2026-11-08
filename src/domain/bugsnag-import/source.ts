import type { Json, ParsedRecord } from '../../modules/import-kit/src/types.ts';
import { sourceText } from '../sentry-import/source.ts';
/** A Bugsnag (SmartBear) organization export: the pages the buyer's authorized
 * Data Access API calls returned (api.bugsnag.com), kept as they were sent. */
export const bugsnagFormat = 'spool-bugsnag-org-export';
export const bugsnagMappingVersion = 'spool-bugsnag-org-v1';
/** The import door's namespace for one Bugsnag organization. */
export const bugsnagNamespacePrefix = 'bugsnag-org:';
/** Native source metadata and archive checks key one organization by this value, so a Bugsnag slug never meets a Sentry one. */
export const bugsnagOrganizationKey = (slug: string) => `bugsnag:${slug}`;
const projectScoped = ['errors', 'events', 'releases', 'stability', 'symbols', 'integrations'];
const organizationScoped = ['projects', 'collaborators'];
// The identifier each documented response row carries.
const idField: Record<string, string> = { stability: 'release_stage_name' };
function fields(value: any, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unsupported bundle shape');
}
export function parseBugsnagOrganization(value: Json): ParsedRecord[] {
  const bundle = value as any;
  fields(bundle, ['format', 'version', 'organization', 'window', 'collections', 'omissions']);
  if (bundle.format !== bugsnagFormat || bundle.version !== 1) throw new Error('Unsupported organization bundle format');
  fields(bundle.organization, ['id', 'slug', 'name']); fields(bundle.window, ['start', 'end']);
  const organization = sourceText(bundle.organization.slug, 'organization'); sourceText(bundle.organization.id, 'organization id');
  const start = Date.parse(bundle.window.start), end = Date.parse(bundle.window.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('Invalid export window');
  if (!Array.isArray(bundle.collections) || !bundle.collections.length || bundle.collections.length > 100 || !Array.isArray(bundle.omissions) || bundle.omissions.some((s: any) => typeof s !== 'string' || s.length > 500)) throw new Error('Invalid collections or omissions');
  const records: ParsedRecord[] = [{ kind: 'manifest', sourceId: organization, payload: { organization: bundle.organization, window: bundle.window, omissions: bundle.omissions }, pointer: '' }];
  const collectionKeys = new Set<string>();
  for (const [collectionIndex, collection] of bundle.collections.entries()) {
    fields(collection, ['kind', 'project', 'pages']);
    const kind = sourceText(collection.kind, 'collection kind');
    const project = collection.project === null ? null : sourceText(collection.project, 'collection project');
    if (projectScoped.includes(kind) && !project || organizationScoped.includes(kind) && project !== null) throw new Error('Collection scope mismatch');
    const key = JSON.stringify([kind, project]); if (collectionKeys.has(key)) throw new Error('Duplicate collection'); collectionKeys.add(key);
    if (!Array.isArray(collection.pages) || !collection.pages.length || collection.pages.length > 100) throw new Error('Invalid pages');
    let expected: string | null = null; const cursors = new Set<string | null>();
    for (const [pageIndex, page] of collection.pages.entries()) {
      fields(page, ['cursor', 'nextCursor', 'response']);
      if (cursors.has(page.cursor)) throw new Error('Repeated page cursor'); cursors.add(page.cursor);
      if (page.cursor !== expected || (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor || page.nextCursor === page.cursor)) || !Array.isArray(page.response)) throw new Error('Broken page chain');
      if (pageIndex < collection.pages.length - 1 && page.nextCursor === null || pageIndex === collection.pages.length - 1 && page.nextCursor !== null) throw new Error('Incomplete page chain');
      expected = page.nextCursor;
      for (const [rowIndex, row] of page.response.entries()) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid API record');
        const id = sourceText(row[idField[kind] ?? 'id'], 'source id');
        records.push({ kind, sourceId: JSON.stringify([organization, project, id]), payload: { organization, project, data: row }, pointer: `/collections/${collectionIndex}/pages/${pageIndex}/response/${rowIndex}` });
      }
    }
  }
  if (!collectionKeys.has(JSON.stringify(['projects', null]))) throw new Error('Projects collection required');
  const rank: Record<string, number> = { manifest: 0, projects: 1, releases: 2, errors: 3, events: 4 };
  return records.sort((a, b) => (rank[a.kind] ?? 5) - (rank[b.kind] ?? 5));
}
