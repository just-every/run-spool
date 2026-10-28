import type { Issue } from './attention';
import { stateLabel, type Request, type Run } from './shared';

export function Priority({ project, issue, request, run, busy, refresh, readOnly = false }: {
  project: string; issue: Pick<Issue, 'id' | 'revision' | 'priority'>; request: Request; run: Run; busy: boolean; refresh: () => void; readOnly?: boolean;
}) {
  if (readOnly) return <span className={`priority-chip ${issue.priority}`}>Priority: {stateLabel(issue.priority)}</span>;
  return <label className="form-field">Priority<select value={issue.priority} disabled={busy} onChange={event => {
    const priority = event.target.value;
    void run(async () => {
      await request(`/api/projects/${encodeURIComponent(project)}/issues/${encodeURIComponent(issue.id)}/priority`, 'PUT', { priority, revision: issue.revision });
      refresh();
    });
  }}>
    <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
  </select></label>;
}
