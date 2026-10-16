import type { Request } from './shared';

export type IssuePanels = {
  operator: Promise<any[]>;
  repairs: Promise<any[]>;
  execution: Promise<any[]>;
};

// Start these reads with the packet, rather than after it has rendered. Each
// destination/refresh gets fresh promises; no settled responses are cached.
export function loadIssuePanels(project: string, issue: string, request: Request): IssuePanels {
  const root = `/api/projects/${encodeURIComponent(project)}`;
  const query = `?issue=${encodeURIComponent(issue)}`;
  const releases = request(`${root}/releases`);
  const panels = {
    operator: Promise.all([request(`${root}/operator-state`), request(`${root}/corrections`)]),
    repairs: Promise.all([request(`${root}/repairs${query}`), releases]),
    execution: Promise.all([request(`${root}/reproducers${query}`), request(`${root}/fixes${query}`), releases]),
  };
  // A panel attaches its error UI when the packet mounts it. Observe rejection
  // immediately as well, including if navigation disposes the packet first.
  for (const promise of Object.values(panels)) void promise.catch(() => {});
  return panels;
}
