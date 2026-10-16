import { useEffect, useState } from 'react';
import type { Request } from './shared';

// Keep the issue list's existing refresh boundary: project changes and explicit
// workspace refreshes. Switching tabs must not change that user-visible flow.
export function useProjectIssues(project: string, revision: number, request: Request) {
  const [data, setData] = useState<{ project: string; rows: any[] } | null>(null);
  const [loading, setLoading] = useState(false), [failed, setFailed] = useState('');
  useEffect(() => {
    if (!project) { setData(null); return; }
    let alive = true;
    setLoading(true); setFailed('');
    request(`/api/projects/${encodeURIComponent(project)}/issues`).then(rows => {
      if (!alive) return;
      setData({ project, rows: rows.map((issue: any) => ({ ...issue, releases: typeof issue.releases === 'string' ? JSON.parse(issue.releases) : issue.releases ?? [] })) });
      setLoading(false);
    }).catch(error => { if (alive) { setFailed(error.message); setLoading(false); } });
    return () => { alive = false; };
  }, [project, revision, request]);
  const scoped = data?.project === project ? data.rows : null;
  return { rows: scoped ?? [], failed, loading: loading || (!!project && !scoped && !failed) };
}
