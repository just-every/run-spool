import { useState } from 'react';
import type { Request } from './shared';
import { useLiveRead } from './useLiveRead';

export function useProjectIssues(project: string, revision: number, request: Request, live: boolean) {
  const [data, setData] = useState<{ project: string; rows: any[] } | null>(null);
  const [loading, setLoading] = useState(false), [failed, setFailed] = useState('');
  useLiveRead(async (signal, background) => {
    if (!background && data?.project !== project) setLoading(true);
    try {
      const rows = await request(`/api/projects/${encodeURIComponent(project)}/issues`);
      if (signal.aborted) return;
      const next = { project, rows: rows.map((issue: any) => ({ ...issue, releases: typeof issue.releases === 'string' ? JSON.parse(issue.releases) : issue.releases ?? [] })) };
      setData(next);
      setFailed('');
    } catch (error) { if (!signal.aborted) setFailed((error as Error).message); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [project, revision, request], { enabled: !!project, live });
  const scoped = data?.project === project ? data.rows : null;
  return { rows: scoped ?? [], failed, loading: loading || (!!project && !scoped && !failed) };
}
