import { convertSentry } from '../sentry/convert.ts';
import type { Envelope } from '../privacy.ts';
import { sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
/** Bugsnag event ids are 24 hex characters; Spool's event identity is 128 bits. A fixed derivation names the same event on every replan. */
export const nativeEventId = (organization: string, project: string, id: string) => sha256(JSON.stringify(['bugsnag-event', organization, project, id])).slice(0, 32);
const text = (value: unknown) => typeof value === 'string' && value ? value : undefined;
const label = (value: unknown) => text(value) ?? (Number.isSafeInteger(value) ? String(value) : undefined);
/** Bugsnag lists a stack newest frame first; the Sentry shape Spool stores is oldest first. Native frames keep their image, addresses and symbol. */
function frame(value: any) {
  const native = typeof value?.frame_address === 'string';
  return {
    filename: text(value?.file), lineno: Number.isSafeInteger(value?.line_number) ? value.line_number : undefined,
    colno: Number.isSafeInteger(value?.column_number) ? value.column_number : undefined, function: text(value?.method),
    ...typeof value?.in_project === 'boolean' ? { in_app: value.in_project } : {},
    ...native ? { package: text(value.file), instruction_addr: text(value.frame_address), symbol_addr: text(value.symbol_address), image_addr: text(value.load_address), platform: 'native' } : {},
  };
}
/** Bugsnag's event detail is a different contract from SDK wire JSON. */
export function bugsnagApiEvent(value: any, nativeId: string): { event: Envelope; received: number; raw: true } {
  if (!value || typeof value !== 'object' || !Array.isArray(value.exceptions) || !value.exceptions.length) throw new Error('Exception event detail required');
  const values = [...value.exceptions].reverse().map((exception: any) => {
    if (!Array.isArray(exception?.stacktrace)) throw new Error('Event detail stack required');
    return { type: exception.error_class, value: exception.message, mechanism: { type: 'bugsnag', handled: value.unhandled !== true },
      stacktrace: { frames: [...exception.stacktrace].reverse().map(frame) } };
  });
  const images = new Map<string, any>();
  for (const exception of value.exceptions) for (const f of exception.stacktrace)
    if (typeof f?.frame_address === 'string' && text(f.macho_uuid) && text(f.load_address)) images.set(`${f.macho_uuid}:${f.load_address}`, { type: 'macho', debug_id: f.macho_uuid, image_addr: f.load_address, code_file: text(f.file) });
  const app = value.app ?? {}, device = value.device ?? {};
  const environment = text(app.release_stage) ?? 'production';
  const dist = label(app.version_code) ?? label(app.bundle_version);
  const crumbs = Array.isArray(value.breadcrumbs) ? value.breadcrumbs.filter((c: any) => typeof c?.name === 'string').map((c: any) => ({ message: c.name, category: text(c.type), timestamp: text(c.timestamp) })) : [];
  const event = convertSentry({ event_id: nativeId, release: text(app.version), dist, environment, platform: text(app.type),
    exception: { values }, breadcrumbs: crumbs, user: value.user,
    tags: { 'bugsnag.event_id': String(value.id), ...text(value.severity) ? { 'bugsnag.severity': value.severity } : {} },
    contexts: Object.fromEntries([['os', { name: text(device.os_name), version: text(device.os_version) }], ['device', { name: text(device.model) }]].map(([key, v]: any) => [key, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined))])),
    ...images.size ? { debug_meta: { images: [...images.values()] } } : {} });
  const received = Date.parse(value.received_at);
  if (!Number.isSafeInteger(received) || received < 0) throw new Error('Event detail timestamp required');
  return { event, received, raw: true };
}
