import { convertSentry } from '../sentry/convert.ts';
import type { Envelope } from '../privacy.ts';
import { sha256 } from '../../modules/import-kit/src/provenance/identity.ts';
/** Bugsnag event ids are 24 hex characters; Spool's event identity is 128 bits. A fixed derivation names the same event on every replan. */
export const nativeEventId = (organization: string, project: string, id: string) => sha256(JSON.stringify(['bugsnag-event', organization, project, id])).slice(0, 32);
const text = (value: unknown) => typeof value === 'string' && value ? value : undefined;
const label = (value: unknown) => text(value) ?? (Number.isSafeInteger(value) ? String(value) : undefined);
/** Bugsnag's Data Access API documents snake_case fields; the Error Reporting API its notifiers send documents camelCase. An export holds either, so each field is read under both names. */
export const field = (value: any, snake: string, camel: string) => value?.[snake] ?? value?.[camel];
/** A coordinate is a whole number, however the export typed it: Bugsnag columns arrive as numbers or as digit strings. */
export const whole = (value: unknown) => { const n = typeof value === 'string' && /^\d{1,9}$/.test(value) ? Number(value) : value; return Number.isSafeInteger(n) && (n as number) >= 0 ? (n as number) : undefined; };
const address = (value: unknown) => text(value) ?? (Number.isSafeInteger(value) && (value as number) >= 0 ? `0x${(value as number).toString(16)}` : undefined);
/** Bugsnag lists a stack newest frame first; the Sentry shape Spool stores is oldest first. Native frames keep their image, addresses and symbol. */
function frame(value: any) {
  const frameAddress = address(field(value, 'frame_address', 'frameAddress')), inProject = field(value, 'in_project', 'inProject');
  return {
    filename: text(value?.file), lineno: whole(field(value, 'line_number', 'lineNumber')),
    colno: whole(field(value, 'column_number', 'columnNumber')), function: text(value?.method),
    ...typeof inProject === 'boolean' ? { in_app: inProject } : {},
    ...frameAddress ? { package: text(value.file), instruction_addr: frameAddress, symbol_addr: address(field(value, 'symbol_address', 'symbolAddress')), image_addr: address(field(value, 'load_address', 'loadAddress')), platform: 'native' } : {},
  };
}
/** Bugsnag's event detail is a different contract from SDK wire JSON. */
export function bugsnagApiEvent(value: any, nativeId: string): { event: Envelope; received: number; raw: true } {
  if (!value || typeof value !== 'object' || !Array.isArray(value.exceptions) || !value.exceptions.length) throw new Error('Exception event detail required');
  const values = [...value.exceptions].reverse().map((exception: any) => {
    if (!Array.isArray(exception?.stacktrace)) throw new Error('Event detail stack required');
    return { type: text(field(exception, 'error_class', 'errorClass')), value: exception.message, mechanism: { type: 'bugsnag', handled: value.unhandled !== true },
      stacktrace: { frames: [...exception.stacktrace].reverse().map(frame) } };
  });
  const images = new Map<string, any>();
  for (const exception of value.exceptions) for (const f of exception.stacktrace)
    {
      const uuid = text(f?.macho_uuid ?? f?.machoUUID ?? f?.machoUuid), load = address(field(f, 'load_address', 'loadAddress'));
      if (address(field(f, 'frame_address', 'frameAddress')) && uuid && load) images.set(`${uuid}:${load}`, { type: 'macho', debug_id: uuid, image_addr: load, code_file: text(f.file) });
    }
  const app = value.app ?? {}, device = value.device ?? {};
  const environment = text(field(app, 'release_stage', 'releaseStage')) ?? 'production';
  const dist = label(field(app, 'version_code', 'versionCode')) ?? label(field(app, 'bundle_version', 'bundleVersion'));
  const crumbs = Array.isArray(value.breadcrumbs) ? value.breadcrumbs.filter((c: any) => typeof c?.name === 'string').map((c: any) => ({ message: c.name, category: text(c.type), timestamp: text(c.timestamp) })) : [];
  const event = convertSentry({ event_id: nativeId, release: text(app.version), dist, environment, platform: text(app.type),
    exception: { values }, breadcrumbs: crumbs, user: value.user,
    tags: { 'bugsnag.event_id': String(value.id), ...text(value.severity) ? { 'bugsnag.severity': value.severity } : {} },
    contexts: Object.fromEntries([['os', { name: text(field(device, 'os_name', 'osName')), version: text(field(device, 'os_version', 'osVersion')) }], ['device', { name: text(device.model) }]].map(([key, v]: any) => [key, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined))])),
    ...images.size ? { debug_meta: { images: [...images.values()] } } : {} });
  const received = Date.parse(field(value, 'received_at', 'receivedAt'));
  if (!Number.isSafeInteger(received) || received < 0) throw new Error('Event detail timestamp required');
  return { event, received, raw: true };
}
