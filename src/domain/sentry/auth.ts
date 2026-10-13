import { SentryWireError, type WireObject } from './wire.ts';
/** Every supplied credential source is authoritative: none can mask another. */
export function sentryKey(request: Request, alias: string, envelope: WireObject = {}): string {
  if (!/^[1-9][0-9]{0,15}$/.test(alias)) throw new SentryWireError('invalid_project_alias', 401);
  const url = new URL(request.url), keys: string[] = [];
  const accept = (key: unknown, version: unknown) => {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_]{1,128}$/.test(key) || String(version) !== '7') throw new SentryWireError('invalid_sentry_auth', 401);
    keys.push(key);
  };
  if (url.searchParams.has('sentry_key') || url.searchParams.has('sentry_version')) {
    if (url.searchParams.getAll('sentry_key').length !== 1 || url.searchParams.getAll('sentry_version').length !== 1) throw new SentryWireError('invalid_sentry_auth', 401);
    accept(url.searchParams.get('sentry_key'), url.searchParams.get('sentry_version'));
  }
  const header = request.headers.get('x-sentry-auth');
  if (header !== null) {
    if (!/^Sentry\s/i.test(header)) throw new SentryWireError('invalid_sentry_auth', 401);
    const values = new Map<string, string>();
    for (const field of header.replace(/^Sentry\s+/i, '').split(',')) {
      const match = /^\s*([a-z_]+)=([^,\s]+)\s*$/.exec(field);
      if (!match || values.has(match[1])) throw new SentryWireError('invalid_sentry_auth', 401);
      values.set(match[1], match[2]);
    }
    accept(values.get('sentry_key'), values.get('sentry_version'));
  }
  if (Object.hasOwn(envelope, 'dsn')) {
    try {
      if (typeof envelope.dsn !== 'string') throw new Error();
      const dsn = new URL(envelope.dsn);
      if (!['http:', 'https:'].includes(dsn.protocol) || dsn.password || dsn.search || dsn.hash || dsn.pathname !== `/${alias}` || dsn.origin !== url.origin) throw new Error();
      accept(dsn.username, 7);
    } catch { throw new SentryWireError('invalid_sentry_dsn', 401) }
  }
  if (request.headers.has('authorization')) {
    const match = /^Bearer ([a-zA-Z0-9_]{1,128})$/.exec(request.headers.get('authorization')!);
    if (!match) throw new SentryWireError('invalid_sentry_auth', 401);
    keys.push(match[1]);
  }
  if (!keys.length || keys.some(key => key !== keys[0])) throw new SentryWireError('conflicting_or_missing_sentry_auth', 401);
  return keys[0];
}
