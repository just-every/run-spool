import type { PlanEntry } from '../../modules/import-kit/src/types.ts';
import { unmigratable } from './mapping.ts';
/** Owner-facing import facts for a Bugsnag plan, read from the reviewed snapshot: event and session denominators are kept apart, and a missing session history is a named gap, never a rate. */
const whole = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const percent = (total: number, unhandled: number) => Math.round((total - unhandled) / total * 10000) / 100;
const mobileTypes = ['android', 'cocoa', 'ios', 'reactnative', 'react-native', 'flutter', 'unity', 'unreal', 'ndk'];
const webTypes = ['js', 'browserjs', 'javascript', 'react', 'vue', 'angular', 'nextjs', 'ember'];
const surfaceOf = (type: unknown) => { const t = String(type ?? '').toLowerCase(); return mobileTypes.includes(t) ? 'mobile' : webTypes.includes(t) ? 'web' : 'server'; };
const nativeSymbols = ['dsym', 'proguard', 'ndk', 'dart', 'breakpad', 'elf'];

function sessions(total: unknown, unhandled: unknown, declaredMissing: boolean) {
  if (declaredMissing || total === undefined || total === null || total === 0) return { state: 'missing', total: null, unhandled: null, crashFreeRate: null, reasonCode: 'historical_sessions_missing' };
  if (!whole(total) || !whole(unhandled) || unhandled > total) return { state: 'inconsistent', total: null, unhandled: null, crashFreeRate: null, reasonCode: 'sessions_inconsistent' };
  return { state: 'exported', total, unhandled, crashFreeRate: percent(total, unhandled), reasonCode: null };
}
export function bugsnagFacts(entries: PlanEntry[]) {
  const kept = (kind: string) => entries.filter(e => e.source.kind === kind);
  const data = (e: PlanEntry) => (e.source.payload as any).data, scope = (e: PlanEntry) => (e.source.payload as any).project as string | null;
  const omissions: string[] = (kept('manifest')[0]?.source.payload as any)?.omissions ?? [];
  const sessionsOmitted = omissions.some(text => /session/i.test(text));
  const accepted = (e: PlanEntry) => !e.rejection;
  const events = kept('events'), errors = kept('errors');
  const rows = errors.map(error => {
    const mine = events.filter(e => scope(e) === scope(error) && data(e).error_id === data(error).id);
    const imported = mine.filter(accepted).length, total = whole(data(error).events) ? data(error).events : null;
    const status = !accepted(error) ? 'rejected' : total === null ? 'no_source_total' : total < mine.length ? 'mismatch' : total === imported ? 'reconciled' : 'sampled';
    return { project: scope(error), errorId: data(error).id, sourceTotal: total, exported: mine.length, imported, notExported: total === null ? null : Math.max(0, total - imported), status };
  });
  const releases = kept('releases').filter(accepted).map(row => {
    const project = scope(row), stage = data(row).release_stage_name ?? null, version = data(row).app_version;
    const mine = events.filter(e => accepted(e) && scope(e) === project && data(e).app?.version === version && (data(e).app?.release_stage ?? null) === stage);
    return { project, release: version, stage, events: { imported: mine.length, unhandled: mine.filter(e => data(e).unhandled === true).length },
      sessions: sessions(data(row).total_sessions_count, data(row).unhandled_sessions_count, sessionsOmitted) };
  });
  const timeline = kept('stability').map(row => {
    const points: any[] = Array.isArray(data(row).timeline_points) ? data(row).timeline_points : [];
    const total = points.reduce((sum, p) => sum + (whole(p?.total_sessions_count) ? p.total_sessions_count : 0), 0), unhandled = points.reduce((sum, p) => sum + (whole(p?.unhandled_sessions_count) ? p.unhandled_sessions_count : 0), 0);
    return { project: scope(row), stage: data(row).release_stage_name, points: points.length, sessions: sessions(points.length ? total : undefined, unhandled, sessionsOmitted) };
  });
  const symbols = kept('symbols');
  const byType = new Map<string, number>();
  for (const s of symbols) byType.set(String(data(s).type), (byType.get(String(data(s).type)) ?? 0) + 1);
  const cutover = kept('projects').filter(accepted).map(project => {
    const slug = data(project).slug, surface = surfaceOf(data(project).type);
    return { project: slug, type: data(project).type ?? null, surface,
      capture: surface === 'server' ? 'Spool SDK or an unmodified Sentry SDK with the Spool DSN' : surface === 'web' ? 'Spool browser SDK or the Sentry browser SDK with the Spool DSN' : 'Sentry mobile SDK with the Spool DSN',
      symbols: symbols.filter(s => scope(s) === slug).map(s => ({ type: data(s).type, release: data(s).app_version ?? null, ...nativeSymbols.includes(String(data(s).type).toLowerCase())
        ? { status: 'not_accepted_yet', reasonCode: 'native_symbols_unsupported' } : { status: 'repoint', command: 'spool-sourcemaps', reasonCode: null } })) };
  });
  return { vendor: 'bugsnag',
    reconciliation: { errors: { source: errors.length, imported: errors.filter(accepted).length, rejected: errors.filter(e => !accepted(e)).length },
      events: { sourceTotal: rows.reduce((sum, r) => sum + (r.sourceTotal ?? 0), 0), exported: events.length, imported: events.filter(accepted).length, rejected: events.filter(e => !accepted(e)).length,
        unhandledImported: events.filter(e => accepted(e) && data(e).unhandled === true).length }, byError: rows },
    stability: { sessionsDeclaredMissing: sessionsOmitted, releases, timeline },
    unmigratable: [...new Set(entries.map(e => e.source.kind))].filter(kind => kind in unmigratable).map(kind => ({ kind, count: kept(kind).length, reason: unmigratable[kind] })),
    cutover, symbolTypes: Object.fromEntries(byType) };
}
