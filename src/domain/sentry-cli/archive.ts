import { releaseIdentity } from '../releases/identity';

/** What unmodified sentry-cli and build plugins registered beyond the existing release and commit tables:
 * finalization time/URL per release and reported deploys. Transient chunk staging and assembly receipts
 * (sentry_upload_chunks, sentry_assemblies) are not archived. Deploys restore as inert history. */
export const sentryCliTables: Record<string, string[]> = {
 sentry_releases: ['project', 'release', 'url', 'started', 'released', 'created'],
 sentry_deploys: ['project', 'id', 'release', 'environment', 'name', 'url', 'started', 'finished', 'actor', 'created'],
};
export const sentryCliExcludedTables = ['sentry_upload_chunks', 'sentry_assemblies'];
export const sentryCliDefaults = (data: any) => ({ ...Object.fromEntries(Object.keys(sentryCliTables).map(name => [name, []])), ...data });
const integer = (value: any) => Number.isSafeInteger(value) && value >= 0;
const optionalInteger = (value: any) => value === null || integer(value);
const optionalText = (value: any, limit: number) => value === null || typeof value === 'string' && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
function assert(ok: unknown): asserts ok { if (!ok) throw new Error('Archive sentry-cli record'); }

export function validateSentryCliArchive(data: any) {
 const projects = new Set(data.projects.map((project: any) => project.id)), releases = new Set(data.releases.map((release: any) => release.project + '\n' + release.name));
 const seen = new Set<string>();
 for (const row of data.sentry_releases) {
  assert(projects.has(row.project) && releases.has(row.project + '\n' + row.release) && integer(row.created) && optionalInteger(row.started) && optionalInteger(row.released) && optionalText(row.url, 2048));
  releaseIdentity(row.release);
  const key = JSON.stringify(['release', row.project, row.release]); assert(!seen.has(key)); seen.add(key);
 }
 for (const row of data.sentry_deploys) {
  assert(projects.has(row.project) && releases.has(row.project + '\n' + row.release) && typeof row.id === 'string' && /^[a-f0-9]{16}$/.test(row.id) && typeof row.environment === 'string' && row.environment.length >= 1 && row.environment.length <= 64 && !/[\u0000-\u001f\u007f/\\]/.test(row.environment));
  assert(optionalText(row.name, 64) && optionalText(row.url, 2048) && optionalInteger(row.started) && optionalInteger(row.finished) && integer(row.created) && /^actor-[a-f0-9-]{36}$/.test(row.actor));
  const key = JSON.stringify(['deploy', row.project, row.id]); assert(!seen.has(key)); seen.add(key);
 }
}
