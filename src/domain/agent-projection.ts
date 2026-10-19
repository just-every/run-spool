import { file, scrub } from './privacy';

// Stored/imported objects are not an authority to expand an agent's read surface.
// Select each leaf, including nested alert payloads, and scrub text again on output.
export const text = (value: unknown, limit = 200) => typeof value === 'string' ? scrub(value).slice(0, limit) : '';
export const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function object(value: any): any {
 if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return null; } }
 return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
export function releaseProjection(value: any) {
 const row = object(value);
 return row ? { name: text(row.name), build: text(row.build), sequence: number(row.sequence) } : null;
}
export function alertPayload(value: any) {
 const row = object(value);
 if (!row) return null;
 const window = object(row.window);
 const rule = object(row.rule);
 return {
  schema: text(row.schema), alertId: text(row.alertId), kind: text(row.kind), projectId: text(row.projectId),
  issueId: text(row.issueId), occurredAt: text(row.occurredAt), ...(typeof row.title === 'string' ? { title: text(row.title, 1000) } : {}),
  release: releaseProjection(row.release),
  // Construct the link from identity; stored URLs are not part of this grant.
  issueUrl: `/projects/${encodeURIComponent(text(row.projectId))}/issues/${encodeURIComponent(text(row.issueId))}`,
  ...(window ? { window: { start: text(window.start), end: text(window.end), durationMs: number(window.durationMs), count: number(window.count), threshold: number(window.threshold) } } : {}),
  ...(rule ? { rule: { id: text(rule.id), revision: number(rule.revision) } } : {}),
 };
}
export function attentionProjection(value: any) {
 const row = object(value);
 return row ? { id: text(row.id), issue: text(row.issue), kind: text(row.kind), created: number(row.created), payload: alertPayload(row.payload) } : null;
}
export function issueProjection(row: any) {
 let releases: unknown = [];
 try { releases = typeof row.releases === 'string' ? JSON.parse(row.releases) : row.releases; } catch { /* No known release list. */ }
 return {
  resolution_mode:row.resolution_mode===undefined?null:text(row.resolution_mode),resolution_release:row.resolution_release==null?null:text(row.resolution_release),seen_without_release:number(row.seen_without_release),id: text(row.id), project: text(row.project), fingerprint: text(row.fingerprint), algorithm: text(row.algorithm),
  title: text(row.title, 1000), state: text(row.state), revision: number(row.revision), count: number(row.count),
  first_seen: number(row.first_seen), last_seen: number(row.last_seen), resolved_seq: number(row.resolved_seq), latest_release_seq: number(row.latest_release_seq),
  attention: attentionProjection(row.attention),
  ...(row.last_release !== undefined ? { last_release: row.last_release === null ? null : text(row.last_release) } : {}),
  ...(row.client_dropped !== undefined ? { client_dropped: number(row.client_dropped) } : {}),
  ...(row.releases !== undefined ? { releases: JSON.stringify(Array.isArray(releases) ? releases.map(value => text(value)) : []) } : {}),
 };
}
export function alertProjection(row: any) {
 return { id: text(row.id), project: text(row.project), issue: text(row.issue), kind: text(row.kind), created: number(row.created),
  payload: row.payload === null ? null : JSON.stringify(alertPayload(row.payload)),
  delivery_count: number(row.delivery_count), routing_state: text(row.routing_state) };
}
export function outcomeProjection(row: any) {
 return { reason: text(row.reason, 120), count: number(row.count) };
}
export function frameProjection(row: any) {
 return { file: file(typeof row?.file === 'string' ? row.file : ''), line: number(row?.line), column: number(row?.column), function: text(row?.function, 1000),
  ...(typeof row?.debugId === 'string' ? { debugId: text(row.debugId) } : {}) };
}
export function diagnosticProjection(rows: any) {
 return Array.isArray(rows) ? rows.slice(0, 30).map(row => ({ generated: frameProjection(row?.generated), status: text(row?.status),
  ...(row?.original ? { original: { file: file(typeof row.original.file === 'string' ? row.original.file : ''), line: number(row.original.line), column: number(row.original.column), function: text(row.original.function, 1000) } } : {}),
  ...(typeof row?.artifactDigest === 'string' ? { artifactDigest: text(row.artifactDigest) } : {}),
  ...(row?.mapping ? {mapping:{from:file(row.mapping.from),to:file(row.mapping.to),repository:text(row.mapping.repository,512),commitSha:text(row.mapping.commitSha),release:text(row.mapping.release),build:text(row.mapping.build),environment:text(row.mapping.environment)}} : {}),
  ...(typeof row?.source === 'string' ? { source: text(row.source) } : {}),
 })) : [];
}
