import { useRouter, useRouterState } from '@tanstack/react-router';
export type View = 'issues' | 'releases' | 'capture' | 'settings' | 'alerts';
export type Destination = { project: string; view: View; issue?: string; unknown?: boolean };
const views: string[] = ['issues', 'releases', 'capture', 'settings', 'alerts'];
export function destination(path: string): Destination {
  if (path === '/') return { project: '', view: 'issues' };
  const parts = path.split('/').filter(Boolean);
  try {
    if (parts[0] !== 'projects' || !parts[1] || !views.includes(parts[2]) || parts.length > (parts[2] === 'issues' ? 4 : 3)) return { project: '', view: 'issues', unknown: true };
    return { project: decodeURIComponent(parts[1]), view: parts[2] as View, ...(parts[3] ? { issue: decodeURIComponent(parts[3]) } : {}) };
  } catch { return { project: '', view: 'issues', unknown: true }; }
}
export function hrefFor(project: string, view: View = 'issues', issue?: string) {
  return project ? `/projects/${encodeURIComponent(project)}/${view}${view === 'issues' && issue ? '/' + encodeURIComponent(issue) : ''}` : '/';
}
export function useDestination() {
  const router = useRouter();
  const pathname = useRouterState({ select: state => state.location.pathname });
  const current = destination(pathname);
  const go = (project: string, view: View = 'issues', issue?: string, replace = false) => void router.navigate({ to: hrefFor(project, view, issue), replace } as any);
  return { ...current, pathname, go };
}
