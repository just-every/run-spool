import type { DoorSnapshot } from '../../modules/import-kit/src/door/types.ts';
import type { SourceRecord } from '../../modules/import-kit/src/types.ts';
import { assertNoCredentials } from '../../modules/import-kit/src/provenance/identity.ts';
import { scrub } from '../scrub';

/** These are labels only, never source IDs, event bodies or stack text. The
 * reader already removed credentials; scrub again at the display boundary. */
export function safeImportLabel(value: unknown): string | null {
 if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) return null;
 const label = scrub(value).trim();
 try { assertNoCredentials(label); } catch { return null; }
 return label || null;
}
export function recordLabel(record: SourceRecord, snapshot: DoorSnapshot) {
 const payload = record.payload as any, data = payload?.data;
 let value: unknown;
 if (record.kind === 'projects') value = data?.name;
 if (record.kind === 'issues') value = data?.title;
 if (record.kind === 'errors') value = data?.message;
 if (record.kind === 'releases') value = data?.version ?? data?.app_version;
 if (record.kind === 'events') {
  const issue = snapshot.plan.source.records.find(r => ['issues','errors'].includes(r.kind) && (r.payload as any)?.project === payload?.project && (r.payload as any)?.data?.id === (data?.groupID ?? data?.error_id));
  value = data?.title ?? ((issue?.payload as any)?.data?.title ?? (issue?.payload as any)?.data?.message);
 }
 const label = safeImportLabel(value);
 return {label, labelReasonCode:label === null ? 'record_label_unavailable' : null};
}
export function snapshotOrganization(snapshot: DoorSnapshot) {
 const manifest = snapshot.plan.source.records.find(r => r.kind === 'manifest');
 return safeImportLabel((manifest?.payload as any)?.organization?.slug ?? (manifest?.payload as any)?.organization?.name);
}
