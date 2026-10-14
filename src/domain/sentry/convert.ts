import { normalize, type Envelope } from '../privacy.ts';
import { SentryWireError, type WireObject } from './wire.ts';
/** Missing dist has a fixed, explicitly registered identity; it never means latest. */
export const absentDist = 'sentry-no-dist';
/** Select the last exception (the outermost reported error); never invent a stack. */
export function convertSentry(value: WireObject, envelopeId?: unknown): Envelope {
  if (value.type !== undefined && value.type !== 'error') throw new SentryWireError('unsupported_event_type', 422);
  if (value.platform !== undefined && !['javascript','node','python','go'].includes(value.platform)) throw new SentryWireError('unsupported_platform', 422);
  const language = ['python','go'].includes(value.platform) ? value.platform : undefined;
  const eventId = value.event_id ?? envelopeId;
  if (typeof eventId !== 'string' || !/^[a-fA-F0-9]{32}$/.test(eventId) || (envelopeId !== undefined && envelopeId !== eventId)) throw new SentryWireError('invalid_event_id');
  if (typeof value.release !== 'string' || !value.release) throw new SentryWireError('missing_release_register_required', 422);
  const exceptions = value.exception?.values;
  if (language === 'python' && Array.isArray(exceptions) && exceptions.some((e:any)=>e?.mechanism?.is_exception_group || /(?:^|\.)(?:Base)?ExceptionGroup$/.test(e?.type ?? ''))) throw new SentryWireError('python_exception_groups_unsupported',422);
  const exception = Array.isArray(exceptions) ? exceptions.at(-1) : undefined;
  const stack = exception?.stacktrace ?? value.stacktrace;
  if (!Array.isArray(stack?.frames)) throw new SentryWireError('exception_stack_required', 422);
  const images = Array.isArray(value.debug_meta?.images) ? value.debug_meta.images : [];
  const frames = stack.frames.slice().reverse().filter((frame: any) => {
    const located = frame &&
    typeof (frame.abs_path ?? frame.filename) === 'string' && Number.isSafeInteger(frame.lineno) && frame.lineno > 0 && frame.lineno <= 1e7 &&
    (language && (frame.colno === undefined || frame.colno === null) || Number.isSafeInteger(frame.colno) && frame.colno > 0 && frame.colno <= 1e7);
    if (language && !located) throw new SentryWireError('exception_coordinates_required',422);
    return located;
  }).slice(0, 30).map((frame: any) => {
      const path = frame.abs_path ?? frame.filename;
      const matches = images.filter((image: any) => image?.type === 'sourcemap' && image.code_file === path);
      const debugIds = new Set(matches.map((image: any) => image.debug_id));
      if (debugIds.size > 1) throw new SentryWireError('conflicting_debug_ids');
      const debugId = matches[0]?.debug_id;
      return { file: path, line: frame.lineno, column: frame.colno == null ? null : frame.colno - 1, function: typeof frame.function === 'string' ? frame.function : '<anonymous>', ...(debugId ? { debugId } : {}) };
    });
  if (!frames.length) throw new SentryWireError('exception_coordinates_required', 422);
  const crumbs = Array.isArray(value.breadcrumbs) ? value.breadcrumbs : value.breadcrumbs?.values;
  const breadcrumbs = Array.isArray(crumbs) ? crumbs.filter((crumb: any) => crumb && typeof crumb.message === 'string').slice(-20).map((crumb: any) => `${typeof crumb.category === 'string' ? crumb.category.slice(0, 100) + ': ' : ''}${crumb.message}`) : [];
  return normalize({ version: 1, ...(language ? {language} : {}), eventId: eventId.toLowerCase(), release: value.release, build: value.dist ?? absentDist,
    environment: value.environment ?? 'production', type: exception?.type ?? 'Error',
    message: exception?.value ?? value.message ?? value.logentry?.formatted ?? '', frames, breadcrumbs });
}
