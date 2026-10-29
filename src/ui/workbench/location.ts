import { useRouter, useRouterState } from '@tanstack/react-router';
export type View = 'issues' | 'releases' | 'capture' | 'settings' | 'alerts' | 'reports';
export type Destination = { project: string; view: View; issue?: string; release?: string; section?: string; redirect?: boolean; unknown?: boolean };
const views: string[] = ['issues', 'releases', 'capture', 'settings', 'alerts', 'reports'];
export function destination(path: string): Destination {
  if (path === '/') return { project: '', view: 'issues' };
  const parts = path.split('/').filter(Boolean);
  try {
    if (parts[0] !== 'projects') return { project: '', view: 'issues', unknown: true };
    if (parts.length <= 2) return { project: parts[1] ? decodeURIComponent(parts[1]) : '', view: 'issues', redirect: true };
    const project = decodeURIComponent(parts[1]), view = parts[2] as View;
    if (!views.includes(view)) return { project, view: 'issues', unknown: true };
    if (view === 'releases' && parts.length === 5 && parts[3] === 'setup' && parts[4] === 'source-maps') return { project, view, section: 'source-maps' };
    if (parts.length > (view === 'issues' || view === 'releases' ? 4 : 3)) return { project, view, unknown: true };
    return { project, view, ...(parts[3] ? view === 'issues' ? { issue: decodeURIComponent(parts[3]) } : { release: decodeURIComponent(parts[3]) } : {}) };
  } catch { return { project: '', view: 'issues', unknown: true }; }
}

export function hrefFor(project: string, view: View = 'issues', issue?: string) {
  return project ? `/projects/${encodeURIComponent(project)}/${view}${(view === 'issues' || view === 'releases') && issue ? '/' + encodeURIComponent(issue) : ''}` : '/';
}
export function sourceMapHref(project: string) { return `${hrefFor(project, 'releases')}/setup/source-maps`; }
export function useDestination() {
  const router = useRouter();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const current = destination(pathname);
  const go = (project: string, view: View = 'issues', issue?: string, replace = false) => void router.navigate({ to: hrefFor(project, view, issue), replace } as any);
  return { ...current, pathname, go };
}
